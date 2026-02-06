# Security Audit

Last updated: 2026-02-06

This document tracks security findings for claudedidwhat, an Electron-based terminal emulator. Because this application is a terminal emulator by design, certain behaviors that would be vulnerabilities in other contexts are expected and intentional here. This document distinguishes between genuine issues, expected behavior, and positive security practices.

---

## Actionable Issues

### 1. Outdated Electron — HIGH

**File:** `package.json` — `electron: ^28.0.0`

Electron 28 is ~2 years old and has a known ASAR integrity bypass CVE (all versions < 35.7.5). The app is also missing years of Chromium security patches. This is the single most impactful upgrade.

**Fix:** Upgrade to latest stable Electron. Major version jump — requires testing.

**Status:** Open

---

### 2. Packaged App Can Load Remote URL via `VITE_DEV_SERVER_URL` — HIGH

**File:** `src/main/index.ts:76-77`

The URL loading logic checks `NODE_ENV`/`VITE_DEV_SERVER_URL` but does not gate this on `app.isPackaged`. A packaged build launched with `VITE_DEV_SERVER_URL` set will load remote content in the privileged window, and that content can call the exposed preload bridge.

**Fix:**
```typescript
const isDev = !app.isPackaged && (
  process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL
)
```

**Status:** Fixed

---

### 3. Missing Navigation and Window-Open Guards — MEDIUM

**File:** `src/main/index.ts`

No `will-navigate` or `setWindowOpenHandler` is registered on the BrowserWindow. If renderer code ever navigates to untrusted content (accidental navigation, drag/drop URL, future feature regression), that page would still run in the app window with preload available.

**Fix:**
```typescript
mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('file://')) event.preventDefault()
})
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
```

**Status:** Fixed

---

### 4. IPC Handlers Do Not Validate Sender Origin — MEDIUM-HIGH

**Files:** `src/main/index.ts`, `src/main/ipc/git.ts`, `src/main/ipc/pty.ts`, `src/main/ipc/fs.ts`, `src/main/ipc/grammar.ts`

IPC handlers trust any renderer frame that can call the channel. This is normally fine while only trusted renderer content loads, but becomes a meaningful escalation path if a navigation bug or renderer compromise occurs.

**Fix:** Add a central sender validation guard (`event.senderFrame.url`) and reject IPC calls from non-app origins.

**Status:** Fixed — all 22 IPC handlers validate sender origin via `validateIpcSender()`

---

### 5. `sandbox: false` May Be Unnecessary — MEDIUM

**File:** `src/main/index.ts:64`

The comment says "Required for node-pty" but node-pty runs in the main process, not the preload. The preload only uses `contextBridge` and `ipcRenderer`, which work in sandboxed preloads. With sandbox disabled, a renderer exploit that bypasses context isolation gets a larger blast radius.

**Fix:** Test with `sandbox: true`. It should work since PTY, git, FS, and grammar operations all live in the main process.

**Status:** Fixed — enabled `sandbox: true`; node-pty runs in main process, preload only uses `contextBridge`/`ipcRenderer`

---

### 6. Vulnerable `electron-builder` Dependencies — MEDIUM (build-time only)

**File:** `package.json` — `electron-builder: ^24.9.0`

`npm audit` reports vulnerabilities in transitive `tar` dependency (path traversal via insufficient sanitization, race condition via Unicode ligature collisions on macOS APFS, hardlink path traversal). These affect the build/packaging pipeline, not runtime.

**Fix:** Upgrade `electron-builder` to `^26.7.0`.

**Status:** Open

---

### 7. No macOS Code Signing for Distribution — MEDIUM

**File:** `electron-builder.json:23` — `"identity": null`

macOS code signing is explicitly disabled. The app has `hardenedRuntime: true` and entitlements configured, but with `identity: null` these are effectively ignored. Users will see Gatekeeper warnings and hardened runtime protections won't be enforced.

**Note:** Acceptable for local development. Must be addressed before public distribution.

**Status:** Open — not blocking until distribution

---

### 8. Predictable `/tmp` Shell Integration Path Allows Local Symlink/Path Hijack — MEDIUM

**File:** `src/main/services/pty-manager.ts:35-69`

Shell integration scripts are written to a fixed path under temp (`/tmp/claudedidwhat-shell-integration`). File modes are restrictive (`0700` dir, `0600` files), but this does not fully mitigate preexisting path/symlink manipulation in shared temp directories.

**Fix:** Use a per-user, app-controlled directory (e.g. app data) or `mkdtemp` with ownership/symlink checks before writing.

**Status:** Fixed — shell integration scripts now use `app.getPath('userData')` with symlink rejection

---

### 9. Grammar Scanner Does Not Enforce Extension-Root Containment — LOW-MEDIUM

**File:** `src/main/services/grammar-scanner.ts:200-203`

Grammar paths from extension metadata are resolved and read, but the resolved path is not checked to remain under the extension directory. A malicious extension package could reference unexpected files.

**Fix:** Resolve the path and verify it starts with `extDir` before reading.

**Status:** Fixed

---

### 10. External Font Blocked by Own CSP — LOW (functional bug)

**File:** `src/renderer/styles/globals.css:1`

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono...');
```

The production CSP (`default-src 'self'`) silently blocks this external import. JetBrains Mono never loads in production builds — CSS fallback fonts (`SF Mono`, `Fira Code`, `Menlo`, etc.) kick in instead. This is dead code in production.

**Fix:** Bundle JetBrains Mono locally as a `@font-face` asset, or remove the import if fallback fonts are acceptable.

**Status:** Fixed — removed dead import; fallback fonts (SF Mono, Fira Code, Menlo, etc.) are used

---

### 11. No Permission Request Handler — LOW (defense-in-depth)

**File:** `src/main/index.ts`

Permission behavior varies by API/platform, but there is no explicit allow/deny policy in the app. Adding one is cheap hardening and prevents surprising permission grants if future renderer content changes.

**Fix:**
```typescript
session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
```

**Status:** Fixed

---

### 12. CSP Missing Defense-in-Depth Directives — LOW

**File:** `src/main/index.ts:188`

The production CSP is solid but could include additional directives that are effectively free:

```
object-src 'none'; base-uri 'self'; form-action 'self';
```

These close edge cases around plugin embeds, `<base>` tag injection, and form submissions to external URLs.

**Status:** Fixed

---

### 13. No IPC Runtime Input Validation — LOW (defense-in-depth)

**Files:** `src/main/ipc/git.ts`, `src/main/ipc/pty.ts`, `src/main/ipc/fs.ts`

IPC handlers accept parameters with TypeScript type annotations but perform no runtime validation. The `contextIsolation: true` + `contextBridge` setup means the renderer can only call explicitly exposed functions, which mitigates this. Runtime validation would be an additional layer of defense.

**Status:** Fixed — all IPC parameters validated at runtime via assertion functions

---

### 14. Git `ref`/`baseBranch` Not Validated Against Argument Injection — LOW

**File:** `src/main/services/git.ts:327,352,386,410`

Parameters like `ref` and `baseBranch` are interpolated into `simple-git` commands without checking for `--` prefixes. `simple-git` uses `execFile` (not shell), so shell injection isn't possible, but git argument injection is theoretically possible for some subcommands. For `rev-parse` and `show` (the commands used here), the risk is very low.

**Fix:** Validate that `ref` and `baseBranch` match `/^[\w\-\.\/]+$/` or at minimum don't start with `--`.

**Status:** Fixed

---

### 15. No Security-Focused ESLint Plugins — LOW

**File:** `.eslintrc.json`

No security-specific ESLint plugins are configured. Adding `eslint-plugin-security` would catch patterns like `eval()`, `exec()`, and other risky APIs during development.

**Status:** Open — low priority

---

### 16. `@typescript-eslint/no-explicit-any` Is Warning, Not Error — LOW

**File:** `.eslintrc.json`

`any` types bypass TypeScript's type system and can hide type confusion bugs. Currently set to `"warn"` — should be `"error"` in a security-conscious codebase.

**Status:** Open — low priority

---

### 17. No Explicit Dev Server Host Binding — LOW (dev-time only)

**File:** `vite.config.ts`

Vite defaults to `localhost`, but if a developer runs with `--host 0.0.0.0`, the dev server is exposed on the network.

**Fix:** Explicitly set `server: { host: 'localhost' }`.

**Status:** Fixed

---

## Hardening / Informational (Non-Vulnerabilities)

### Explicit `asar: true` for Config Clarity

**File:** `electron-builder.json`

Electron-builder defaults to ASAR packing. This is not currently a vulnerability, but explicitly setting `"asar": true` prevents accidental behavior changes in future config edits.

### Explicit `build.sourcemap: false` for Clarity

**File:** `vite.config.ts`

Vite production builds default to no source maps unless enabled. This is not currently a vulnerability. Explicitly setting `sourcemap: false` can make intent clear.

## Not Vulnerabilities (Expected Terminal Emulator Behavior)

These were evaluated during the audit and confirmed to be intentional, expected behavior for a terminal emulator. They should NOT be "fixed."

### PTY Spawning Arbitrary Shells and Commands

The renderer can specify a shell path via `PtySpawnOptions.shell`, and the PTY executes arbitrary commands typed by the user. This is the core purpose of a terminal emulator.

### `process.env` Passed to Child Shells

**File:** `src/main/services/pty-manager.ts:155-159`

The entire `process.env` is spread into the PTY environment. Every terminal emulator (iTerm, Terminal.app, Windows Terminal, VS Code) does this. Stripping environment variables would break `PATH`, `HOME`, `SSH_AUTH_SOCK`, `LANG`, and other necessary variables.

### Clipboard Paste into Terminal

**File:** `src/renderer/hooks/useTerminal.ts:192`

Pasted clipboard content is written to the PTY. "Pastejacking" (malicious clipboard content executing commands) is a known risk in ALL terminal emulators and is not specific to this application.

### User-Specified CWD for Shell Spawn

**File:** `src/renderer/context/SessionContext.tsx:67-72`

Users can open a terminal in any directory they have access to. The main process validates the directory exists via `existsSync(cwd)`.

### Reading Files Within Git Repositories

The git service reads files and diffs within repositories the user has opened. This is intended feature functionality, protected by path traversal guards.

### Broad macOS Entitlements

**File:** `resources/entitlements.mac.plist`

`allow-jit`, `allow-unsigned-executable-memory`, and `disable-library-validation` are all required for Electron apps with native addons (node-pty). These are standard for this class of application.

### Non-Cryptographic Session IDs

**File:** `src/renderer/context/SessionContext.tsx:26`

Session IDs use `Date.now()` + `Math.random()`. These are local-only identifiers for routing PTY data — never used for authentication or transmitted externally.

---

## Positive Security Findings (Already Done Right)

These practices are confirmed correct and should be maintained.

### Context Isolation and Node Integration

**File:** `src/main/index.ts:60-65`

`contextIsolation: true` and `nodeIntegration: false` are both set. The renderer cannot access Node.js APIs directly.

### contextBridge Used Correctly

**File:** `src/preload/index.ts`

The preload exposes a structured `electronAPI` object via `contextBridge.exposeInMainWorld()`. Raw `ipcRenderer` is never exposed to the renderer. Each function wraps a specific IPC channel — no arbitrary channel invocation is possible from the renderer.

### `execFile` Instead of `exec` Throughout

**Files:** `src/main/index.ts:173`, `src/main/services/pty-manager.ts:273`

All process spawning uses `execFile` with arguments as array elements, preventing shell injection. This was remediated in commit `f6946d9`.

### Path Traversal Protection in Git Service

**File:** `src/main/services/git.ts:11-17`

`resolveRepoPath()` validates that resolved file paths stay within the git root directory. Used in `getFileDiff` and `getFileContent`.

### Symlinks Not Followed in File Watcher

**File:** `src/main/services/watcher.ts:51`

Chokidar is configured with `followSymlinks: false`, preventing symlink-based directory traversal.

### URL Scheme Validation on `openExternal`

**File:** `src/main/index.ts:167-177`

`shell:openExternal` validates URLs match `^https?:\/\/` before opening, blocking `file://`, `javascript:`, `data:`, and custom protocol URLs. The WSL2 path uses `execFile` (not `exec`) with the URL as a single argument.

### No Unsafe HTML Rendering in Renderer

All renderer code uses React JSX (auto-escapes) or xterm.js (canvas-based). Zero usage of `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval()`, or `new Function()`.

### Terminal Output Rendered Safely via xterm.js

**File:** `src/renderer/hooks/useTerminal.ts:213`

Terminal output is written to xterm.js which renders to an HTML canvas, not the DOM. No XSS is possible from terminal output.

### Production CSP Blocks External Resources

**File:** `src/main/index.ts:186-197`

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

Applied via `session.defaultSession.webRequest.onHeadersReceived` (not meta tag). Blocks inline scripts and external resource loading in production.

### IPC Listener Cleanup

**File:** `src/preload/index.ts`

All `on`-style listeners return cleanup functions (`() => ipcRenderer.removeListener(...)`) preventing listener leaks.

### Event Dispatcher Isolation

**File:** `src/renderer/lib/eventDispatchers.ts`

PTY data and file change events are routed to session-specific handlers via `Map<string, Set<Handler>>`. No cross-session data leaks. Single global IPC listener pattern avoids duplicate listener registration.

### No Custom Protocol Handlers

No `registerProtocol` or `interceptProtocol` calls. The app uses only the default `file://` protocol for loading renderer content in production.

### No Auto-Updater

No `electron-updater` dependency. No auto-update attack surface. Updates are manual.

### Strict TypeScript Configuration

**File:** `tsconfig.json`

`"strict": true` enables `strictNullChecks`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, and `forceConsistentCasingInFileNames`.

### `.gitignore` Excludes Sensitive Files

`.env`, `.env.local`, and `.env.*.local` are all gitignored. No `.env` files exist in the repository.
