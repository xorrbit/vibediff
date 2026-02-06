# Electron Upgrade Plan: v28 → v40 (Latest Stable)

## Overview

This upgrade addresses two open SECURITY.md issues:

- **Issue #1 (HIGH):** Electron 28 has an ASAR integrity bypass CVE (all versions < 35.7.5) and is missing 2 years of Chromium security patches.
- **Issue #6 (MEDIUM):** electron-builder 24.x has vulnerable transitive `tar` dependencies (path traversal, race conditions).

The upgrade jumps **12 major versions** to Electron 40 (Chromium 144, Node 24). We are in a separate worktree (`omg-upgrade-electron`) so everything is safely reversible.

---

## Breaking Changes Audit (Electron 29–40)

The codebase was audited against every Electron breaking change from v29 through v40. Here is what applies to us:

| Version | Breaking Change | Impact on This Project |
|---------|----------------|----------------------|
| 29 | Sending entire `ipcRenderer` via contextBridge returns empty object | **None** — we expose individual methods, not the module |
| 30 | `BrowserView` deprecated → `WebContentsView` | **None** — we use `BrowserWindow` directly |
| 32 | `File.path` removed → use `webUtils.getPathForFile()` | **None** — not used |
| 33 | macOS 10.15 dropped; C++20 required for native modules | **Low** — verify build toolchain |
| 35 | `webRequest` filter: empty `urls[]` no longer matches all | **Action required** — our `onHeadersReceived` has no filter |
| 38 | macOS 11 dropped — requires macOS 12+ | **Informational** |
| 40 | Renderer clipboard API deprecation | **None** — we use standard `navigator.clipboard` Web API |

**No deprecated APIs are used anywhere in the codebase.** All IPC patterns, preload usage, session APIs, and app lifecycle methods are modern and compatible.

---

## Step 1: Update `package.json` Dependencies ✅ DONE

### Core Electron ecosystem

| Package | Current | Target | Why |
|---------|---------|--------|-----|
| `electron` | `^28.0.0` | `^40.0.0` | Fix ASAR CVE, get 2 years of Chromium patches |
| `electron-builder` | `^24.9.0` | `^26.0.0` | Fix vulnerable `tar` transitive deps |
| `@electron/rebuild` | `^4.0.3` | `^4.0.3` | Keep — compatible with Electron 40 |
| `node-pty` | `^1.0.0` | `^1.1.0` | Latest stable, must rebuild against Electron 40 ABI |
| `vite-plugin-electron` | `^0.15.0` | `^0.29.0` | Latest compatible with Vite 5 |
| `vite-plugin-electron-renderer` | `^0.14.5` | `^0.14.6` | Minor patch |
| `@types/node` | `^20.10.0` | `^22.0.0` | Closer match to Electron 40's Node 24 |

### xterm.js package migration (rename to `@xterm/*` scope)

The xterm.js project moved all packages to the `@xterm/` npm scope. Our codebase is partially migrated (`@xterm/addon-webgl` already uses the new scope) but three packages still use old names.

| Remove (old) | Add (new) | Target Version |
|-------------|-----------|----------------|
| `xterm` | `@xterm/xterm` | `^5.5.0` |
| `xterm-addon-fit` | `@xterm/addon-fit` | `^0.10.0` |
| `xterm-addon-web-links` | `@xterm/addon-web-links` | `^0.11.0` |
| _(keep)_ `@xterm/addon-webgl` | _(update if needed)_ | `^0.19.0` |

**Not upgrading to xterm 6.0** — staying on 5.x scoped packages to minimize risk. xterm 6 removes `fastScrollModifier` and has deeper API changes. A follow-up upgrade can target xterm 6 separately if desired.

---

## Step 2: Update xterm Imports in Source Code ✅ DONE

**File: `src/renderer/hooks/useTerminal.ts`**

### Import changes (lines 2–7):

```diff
-import { Terminal } from 'xterm'
-import { FitAddon } from 'xterm-addon-fit'
-import { WebLinksAddon } from 'xterm-addon-web-links'
+import { Terminal } from '@xterm/xterm'
+import { FitAddon } from '@xterm/addon-fit'
+import { WebLinksAddon } from '@xterm/addon-web-links'
 import { WebglAddon } from '@xterm/addon-webgl'
-import 'xterm/css/xterm.css'
+import '@xterm/xterm/css/xterm.css'
```

### Terminal constructor (lines 120–131):

No changes needed for xterm 5.5.x — `fastScrollModifier`, `fastScrollSensitivity`, and `allowProposedApi` are all still valid in xterm 5.x.

> **Note:** If we later upgrade to xterm 6.0, `fastScrollModifier` and `fastScrollSensitivity` must be removed (they were dropped in 6.0).

---

## Step 3: Update xterm Mocks in Tests ✅ DONE

**File: `tests/unit/renderer/hooks/useTerminal.test.ts`**

```diff
-vi.mock('xterm', () => ({
+vi.mock('@xterm/xterm', () => ({
   Terminal: vi.fn(() => mockTerminal),
 }))

-vi.mock('xterm-addon-fit', () => ({
+vi.mock('@xterm/addon-fit', () => ({
   FitAddon: vi.fn(() => mockFitAddon),
 }))

-vi.mock('xterm-addon-web-links', () => ({
+vi.mock('@xterm/addon-web-links', () => ({
   WebLinksAddon: vi.fn(),
 }))

 // @xterm/addon-webgl mock — already correct, no change

-vi.mock('xterm/css/xterm.css', () => ({}))
+vi.mock('@xterm/xterm/css/xterm.css', () => ({}))
```

---

## Step 4: Electron API Compatibility Fix ✅ DONE

**File: `src/main/index.ts` (line 227)**

Electron 35 changed `WebRequestFilter.urls` behavior: empty arrays no longer match all URLs. Our `onHeadersReceived` call has **no filter at all**, which works but should be made explicit for forward compatibility.

```diff
-    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
+    session.defaultSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
```

This is the **only** Electron API change required. All other APIs used in the codebase (BrowserWindow, ipcMain, contextBridge, session, dialog, Menu, shell, screen, nativeImage, app lifecycle) are unchanged through Electron 40.

---

## Step 5: Update SECURITY.md ✅ DONE

Mark both issues as fixed:

**Issue #1:**
```
**Status:** Fixed — upgraded to Electron 40 (Chromium 144, Node 24); ASAR integrity bypass CVE resolved
```

**Issue #6:**
```
**Status:** Fixed — upgraded electron-builder to ^26.0.0
```

---

## Step 6: Install and Rebuild ✅ DONE

```bash
# Remove old xterm packages, install new ones, update all deps
npm install

# Rebuild node-pty native bindings against Electron 40's Node ABI
npm run postinstall
# (runs: electron-rebuild -f -w node-pty)
```

### If `@electron/rebuild` fails against Electron 40:
```bash
# Update @electron/rebuild to latest
npm install -D @electron/rebuild@latest
npm run postinstall
```

### If node-pty rebuild fails entirely:
```bash
# Alternative: try node-pty 1.2.0-beta which has prebuilt binaries
npm install node-pty@1.2.0-beta.3
npm run postinstall
```

---

## Step 7: Verification Checklist ✅ DONE (automated checks)

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Lint passes | `npm run lint` | No import errors, no new lint issues |
| Unit tests pass | `npm run test:unit` | All tests green (updated mocks work) |
| TypeScript compiles | `npm run build` | Clean build, no type errors |
| Dev server starts | `npm run dev` | Window opens, terminal renders |
| PTY works | _(manual)_ Type in terminal | Commands execute, output displays |
| WebGL renderer loads | _(manual)_ Check console | No WebGL fallback warnings |
| Context menu works | _(manual)_ Right-click terminal | Copy/Paste/Select All/Clear all work |
| Links clickable | _(manual)_ `echo https://example.com` | URL is clickable, opens in browser |
| Window controls work | _(manual)_ Min/Max/Close buttons | All respond correctly |
| Resize works | _(manual)_ Resize window | Terminal reflows properly |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| node-pty ABI mismatch with Electron 40 | Medium | Rebuild with `@electron/rebuild`; fallback to beta |
| vite-plugin-electron 0.29 breaks build | Low | Can pin to intermediate version (0.20–0.28) |
| xterm import rename missed somewhere | Very Low | Lint + build will catch immediately |
| Electron 40 behavior regression | Very Low | Codebase uses no deprecated APIs |

**Safety net:** We are in the `omg-upgrade-electron` worktree — the main branch is untouched. If anything goes catastrophically wrong, `git checkout .` reverts everything.

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `package.json` | Bump electron, electron-builder, node-pty, vite-plugin-electron, @types/node; swap xterm packages to @xterm/* scope |
| `src/renderer/hooks/useTerminal.ts` | Update 4 import paths (xterm → @xterm scope) |
| `tests/unit/renderer/hooks/useTerminal.test.ts` | Update 4 mock paths (xterm → @xterm scope) |
| `src/main/index.ts` | Add `{ urls: ['<all_urls>'] }` filter to `onHeadersReceived` |
| `SECURITY.md` | Mark issues #1 and #6 as Fixed |
