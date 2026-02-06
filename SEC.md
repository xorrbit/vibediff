# Security Audit & Remediation Plan

Audit date: 2026-02-06

## Context

This application is a **terminal emulator** built with Electron. Its core purpose is to execute
arbitrary shell commands, access the filesystem, and display git information. Many patterns that
would be vulnerabilities in a web app or sandboxed tool are **expected behavior** here.

The threat model focuses on:
- A **compromised renderer process** (e.g. via a future XSS or dependency supply chain attack)
  escalating beyond what the terminal already permits
- **Multi-user system attacks** (symlinks, world-readable temp files)
- **Defense-in-depth** — eliminating unnecessary attack surface even where risk is low

Findings that are simply "the terminal can do terminal things" are excluded.

---

## Dismissed Findings (Not Vulnerabilities)

These were flagged in the initial scan but are **correct behavior for a terminal emulator**:

| Finding | Why It's Fine |
|---|---|
| Full `process.env` passed to PTY | Every terminal emulator does this. Missing `PATH`, `SSH_AUTH_SOCK`, etc. would break the shell. |
| No path restrictions on git/fs IPC handlers | The app follows the terminal CWD. Restricting directories would break core functionality. Same as VS Code, iTerm, etc. |
| Sandbox disabled (`sandbox: false`) | Required for node-pty. The terminal inherently runs arbitrary code — sandboxing the renderer while the PTY accepts unconstrained input provides no real boundary. |
| Arbitrary shell parameter from renderer | Even without this, a compromised renderer can type `exec /path/to/anything` into an open PTY session. Restricting the spawn path doesn't add a meaningful barrier. |
| Error messages show system paths | The user can type `pwd`. Paths are not sensitive in a terminal context. |
| URL validation in `shell:openExternal` | Already validated as `http(s)` in main process. `execFile` (WSL path) doesn't use shell interpolation. |
| xterm WebLinksAddon URLs | Main process handler already enforces protocol check. |
| No git branch name validation | `simple-git` uses `child_process.spawn`, not shell. Malformed branch names fail safely — no injection vector. |

---

## Actionable Fixes

### Task 1: Use `execFile` instead of `exec` for lsof call

**File:** `src/main/services/pty-manager.ts:273`
**Severity:** Low (pid is always numeric from node-pty, but poor practice)
**Effort:** Trivial

The `pid` is interpolated into a shell command string. While `instance.pty.pid` is always a
number, using `execFile` with an args array eliminates the entire class of injection risk.

```typescript
// Before
const { stdout } = await execAsync(`lsof -a -d cwd -p ${pid} -F n 2>/dev/null`, {
  timeout: 1000,
})

// After
import { execFile } from 'child_process'
const { stdout } = await execFileAsync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-F', 'n'], {
  timeout: 1000,
})
```

Also update the import at line 5 from `exec` to `execFile`, and the promisify at line 9.

---

### Task 2: Set restrictive permissions on shell integration temp directory

**File:** `src/main/services/pty-manager.ts:39-48`
**Severity:** Medium (real risk on multi-user systems)
**Effort:** Trivial

Shell integration scripts are written to `/tmp/claudedidwhat-shell-integration/` with default
permissions. On a shared system, another user could:
- Pre-create the directory as a symlink to redirect script writes
- Replace scripts between creation and shell startup (TOCTOU)

The scripts source the user's `.bashrc`/`.zshrc`, so hijacking them means code execution in the
user's shell.

**Fix:**
1. Create directory with `mode: 0o700`
2. Set file permissions to `0o600`
3. Verify the directory is owned by the current user (not a symlink) before writing

```typescript
mkdirSync(dir, { recursive: true, mode: 0o700 })
writeFileSync(join(dir, 'bash-integration.bash'), bashScript, { mode: 0o600 })
writeFileSync(join(dir, '.zshenv'), zshEnv, { mode: 0o600 })
writeFileSync(join(dir, '.zshrc'), zshRc, { mode: 0o600 })
```

---

### Task 3: Tighten Content Security Policy for production builds

**File:** `src/main/index.ts`, `index.html`
**Severity:** Medium (weakens XSS mitigations)
**Effort:** Moderate

The CSP included `'unsafe-eval'` (needed for Vite HMR in dev) and `'unsafe-inline'` for styles.
In production, `unsafe-eval` is unnecessary and allows `eval()` execution if an XSS is found.

**Fix:** Removed the CSP meta tag from `index.html` and set CSP via Electron's
`session.defaultSession.webRequest.onHeadersReceived` in the main process — production only.
Dev mode is excluded because `onHeadersReceived` applies to all responses (JS modules, WebSocket
upgrades, etc.), which breaks Vite's HMR WebSocket connections (`ws:` doesn't match `'self'`).

Production CSP:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

`'unsafe-inline'` for `style-src` is acceptable — Tailwind and most CSS-in-JS solutions require
it, and style injection alone (without script execution) has very limited attack surface.

---

### Task 4: Add path containment check for git file reads

**File:** `src/main/services/git.ts:371, 397`
**Severity:** Low (renderer already has terminal access, but good practice)
**Effort:** Trivial

`getFileDiff` and `getFileContent` use `join(gitRoot, filePath)` to read files from disk. If
`filePath` contains `../../`, it resolves outside the repo. While the renderer could just type
`cat /etc/passwd` in the terminal, constraining the git service to its repo is good practice.

The `git show` calls (line 370, 394) are safe — git itself rejects paths outside the repo tree.
Only the `readFile` calls need protection.

**Fix:** Resolve and verify containment before reading:

```typescript
import { resolve } from 'path'

function resolveRepoPath(gitRoot: string, filePath: string): string | null {
  const resolved = resolve(gitRoot, filePath)
  if (!resolved.startsWith(gitRoot + '/') && resolved !== gitRoot) {
    return null // Path escapes repo
  }
  return resolved
}
```

Apply to:
- `git.ts:371` — `readFile(join(result.gitRoot, filePath), ...)`
- `git.ts:397` — `readFile(join(readDir, filePath), ...)`

---

### Task 5: Disable symlink following in chokidar

**File:** `src/main/services/watcher.ts:50`
**Severity:** Low
**Effort:** Trivial (one line)

Chokidar follows symlinks by default. A symlink inside a watched project directory could cause
the watcher to report events for files outside the project tree. While this is low-risk in a
terminal emulator context, it's a free fix.

```typescript
const watcher = chokidar.watch(dir, {
  followSymlinks: false,  // Add this
  ignored: [...],
  // ...
})
```

---

## Fix Priority Order

| # | Task | Severity | Effort | Rationale |
|---|---|---|---|---|
| 1 | `execFile` for lsof | Low | 5 min | Eliminates injection class entirely, zero risk of regression |
| 2 | Temp dir permissions | Medium | 5 min | Real attack vector on shared systems, trivial fix |
| 3 | Production CSP | Medium | 30 min | Reduces XSS impact, slightly more involved |
| 4 | Git file path containment | Low | 10 min | Defense-in-depth, simple utility function |
| 5 | Chokidar `followSymlinks` | Low | 1 min | One-liner, no downside |

Total estimated effort: ~1 hour

---

## Non-Security Improvements Noticed

These are code quality observations, not security issues:

- `pty:getCwd` channel is hardcoded as a string literal instead of using a `PTY_CHANNELS` constant
  (`src/preload/index.ts:55`, `src/main/ipc/pty.ts:42`). Same for `shell:openExternal`,
  `window:*` channels, and `fs:selectDirectory`.
- Development security warning suppression (`src/main/index.ts:7-8`) checks
  `VITE_DEV_SERVER_URL` in addition to `NODE_ENV`. The `VITE_DEV_SERVER_URL` check is redundant
  if `NODE_ENV` is set correctly, and could theoretically suppress warnings in a misconfigured
  production build.
