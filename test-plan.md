# Test Coverage Gap Plan

## Goal
Document current test coverage gaps and define specific tests to add. This file is planning only. No test implementation work is included.

## Progress (2026-02-07)
- Completed:
  - Gap 1: Added main-process lifecycle/security tests:
    - `tests/unit/main/index.test.ts`
    - Covered: dev-mode gating, secure BrowserWindow prefs, navigation blocking, `setWindowOpenHandler`, CSP registration, permission denial, IPC sender checks, `shell:openExternal` protocol/WSL branching, `before-quit` cleanup, `sendToRenderer`.
  - Gap 2: Added IPC registration tests:
    - `tests/unit/main/ipc/pty.test.ts`
    - `tests/unit/main/ipc/git.test.ts`
    - `tests/unit/main/ipc/fs.test.ts`
    - `tests/unit/main/ipc/grammar.test.ts`
  - Gap 3: Added preload bridge contract tests:
    - `tests/unit/preload/index.test.ts`
  - Gap 6: Added event dispatcher fan-out/cleanup tests:
    - `tests/unit/renderer/lib/eventDispatchers.test.ts`
  - Gap 9: Added/expanded security utility edge tests:
    - `tests/unit/main/security/path-utils.test.ts`
    - `tests/unit/main/security/trusted-renderer.test.ts` (expanded)
  - Gap 4 (partial): Replaced weak/no-op E2E assertions and tightened launch gating:
    - `tests/e2e/diff.spec.ts` (state visibility checks replace always-pass assertions)
    - `tests/e2e/tabs.spec.ts` (tab count increments asserted for double-click and `Ctrl+T`)
    - `tests/e2e/terminal.spec.ts` (terminal output/text change asserted after deterministic command)
    - `tests/e2e/app.spec.ts` + launch args updates (explicit `ELECTRON_TEST` gating + no-sandbox launch args)
  - Gap 5: Added `useTerminal` behavioral harness tests:
    - `tests/unit/renderer/hooks/useTerminal.test.tsx`
    - Covered: real ref container dimensions, init/spawn/resize flow, context menu actions, PTY data/exit, cleanup (`unsubscribe`, `kill`, `dispose`).
  - Gap 7: Added app-level integration tests:
    - `tests/unit/renderer/App.test.tsx`
    - Covered: TabBar/Session rendering, empty-state route, help overlay open/close, keyboard shortcut handlers for tab navigation/close, focus handoff on tab switch.
  - Gap 8: Expanded Monaco/diff pooling coverage:
    - `tests/unit/renderer/components/MonacoDiffEditor.test.tsx`
    - `tests/unit/renderer/components/DiffView.test.tsx` (expanded)
    - `tests/unit/renderer/components/DiffPanel.test.tsx` (expanded)
    - Covered: one-time Monaco setup, pool cap eviction, active editor visibility toggling, view-mode option switching, mode cycling, clipboard actions, resize clamp boundaries.
  - Gap 10: Extended SessionContext edge-path assertions:
    - `tests/unit/renderer/hooks/useSessions.test.tsx` (expanded)
    - `src/renderer/context/SessionContext.tsx` (small no-churn update for unchanged session names on `onCwdChanged`)
    - Covered: home-dir fallback, hidden-tab poll suppression, visibility-triggered refresh, `onCwdChanged` map/name updates, unchanged-value no-op behavior.
- In progress:
  - Gap 4 (remaining): deterministic E2E fixtures/mocks and stricter CI prerequisite failure signaling.
  - Coverage config follow-up: revisit coverage filters and thresholds for `src/main/*` now that main-process tests are in place.
  - `2026-02-07` verification run: `npm run test:unit` passed (`36` files, `481` tests).

## Current Coverage Snapshot
- Unit tests are concentrated in renderer hooks/components and main service classes.
- Main-process startup, IPC wiring modules, preload bridge, and security helpers now have direct unit coverage.
- E2E assertions were strengthened, but deterministic fixture/mocking work remains for higher signal and lower flake risk.
- `vitest` coverage still excludes `src/main/**/*`; thresholds/filter follow-up remains open (`vitest.config.ts:12`).

## Priority Model
- `P0`: Security boundary, IPC authorization/validation, lifecycle behavior.
- `P1`: Core user workflows that can regress silently.
- `P2`: Edge cases, refactors, and confidence hardening.

## Gap 1 (`P0`) Main Process Security + Lifecycle (`src/main/index.ts`)
### Gap Location
- `src/main/index.ts:16`
- `src/main/index.ts:50`
- `src/main/index.ts:86`
- `src/main/index.ts:117`
- `src/main/index.ts:205`
- `src/main/index.ts:220`
- `src/main/index.ts:266`

### Why It Matters
- This file controls trust boundaries (navigation, external URLs, CSP, permissions, IPC gatekeeping) and app lifecycle cleanup.
- Regressions here can create security or availability issues that renderer tests do not catch.

### Tests To Add
- Add `tests/unit/main/index.test.ts` with Electron module mocks.
- Verify `isDev` logic only allows dev mode when unpackaged.
- Verify BrowserWindow is created with secure prefs (`contextIsolation`, `sandbox`, `nodeIntegration: false`).
- Verify untrusted `will-navigate` URLs are blocked and trusted ones pass.
- Verify `setWindowOpenHandler` returns deny.
- Verify CSP header registration occurs only when not dev.
- Verify permission requests are always denied.
- Verify each registered IPC handler checks sender validity before action.
- Verify `shell:openExternal` rejects non-http(s) and branches correctly on WSL vs non-WSL.
- Verify `before-quit` triggers `ptyManager.killAll()` and `fileWatcher.unwatchAll()`.
- Verify `sendToRenderer` no-ops when no window and sends when window exists.

## Gap 2 (`P0`) IPC Registration Modules Not Directly Tested
### Gap Location
- `src/main/ipc/pty.ts:18`
- `src/main/ipc/git.ts:9`
- `src/main/ipc/fs.ts:11`
- `src/main/ipc/grammar.ts:8`

### Why It Matters
- These modules enforce input validation and sender trust before handing control to privileged services.

### Tests To Add
- Add:
  - `tests/unit/main/ipc/pty.test.ts`
  - `tests/unit/main/ipc/git.test.ts`
  - `tests/unit/main/ipc/fs.test.ts`
  - `tests/unit/main/ipc/grammar.test.ts`
- For each handler:
  - Assert unauthorized sender throws or returns without side effects (as designed).
  - Assert malformed params are rejected and service methods are not called.
  - Assert valid payloads call the correct service method with expected args.
- PTY-specific:
  - Assert `INPUT/RESIZE/KILL` ignore invalid payloads.
  - Assert `SPAWN` forwards callbacks and propagates spawn errors.

## Gap 3 (`P0`) Preload API Bridge Contract Not Tested
### Gap Location
- `src/preload/index.ts:16`
- `src/preload/index.ts:132`

### Why It Matters
- Renderer depends on this contract for all privileged operations. Channel mismatches or unsubscribe bugs can silently break app features.

### Tests To Add
- Add `tests/unit/preload/index.test.ts`.
- Mock `contextBridge` and `ipcRenderer`.
- Assert `contextBridge.exposeInMainWorld('electronAPI', ...)` is called.
- Assert each API method uses correct `invoke` vs `send` channel and argument order.
- Assert listener methods (`onData`, `onExit`, `onCwdChanged`, `onFileChanged`, `onContextMenuAction`) correctly register and return working unsubscribe functions.

## Gap 4 (`P0`) E2E Assertions Too Weak / No-Op
### Gap Location
- `tests/e2e/diff.spec.ts:47`
- `tests/e2e/diff.spec.ts:66`
- `tests/e2e/tabs.spec.ts:55`
- `tests/e2e/terminal.spec.ts:61`

### Why It Matters
- Assertions like `expect(count).toBeGreaterThanOrEqual(0)` and `expect(true).toBe(true)` do not validate behavior and allow regressions to pass.

### Tests To Add
- Replace no-op assertions with behavior checks:
  - Diff panel: assert one concrete state is visible (`No changes detected`, `Not in a git repo`, or file list item count > 0).
  - Tabs: assert tab count increments after `Ctrl+T` and after double-click empty area.
  - Terminal: assert terminal output changes after typing known command in a deterministic test shell/mocked backend.
- Add deterministic test fixtures or mock IPC backend for E2E to avoid flaky environment dependence.
- Tighten skip behavior: track and fail intentionally when launch prerequisites are expected but missing in CI profile.

## Gap 5 (`P1`) `useTerminal` Tests Mostly Structural, Not Behavioral
### Gap Location
- `src/renderer/hooks/useTerminal.ts:85`
- `src/renderer/hooks/useTerminal.ts:174`
- `src/renderer/hooks/useTerminal.ts:232`
- `tests/unit/renderer/hooks/useTerminal.test.tsx:80`

### Why It Matters
- This hook orchestrates terminal startup, subscriptions, context menu actions, resize logic, and cleanup.
- Current tests often assert mocks are defined rather than validating runtime behavior.

### Tests To Add
- Build a test harness component that attaches `terminalRef` to a real DOM node with dimensions.
- Assert initialization path:
  - `Terminal.open` called.
  - `pty.spawn` called with correct `sessionId/cwd`.
  - initial and follow-up `pty.resize` calls occur with positive dimensions.
- Assert context menu flow:
  - right-click calls `terminal.showContextMenu` with selection state.
  - context action callbacks trigger `copy`, `paste`, `selectAll`, `clear`.
- Assert PTY subscription flow:
  - data callback writes to terminal.
  - exit callback triggers `onExit`.
- Assert cleanup:
  - unsubscribe functions called.
  - `pty.kill(sessionId)` called.
  - terminal disposed.

## Gap 6 (`P1`) Event Dispatcher Fan-Out/Cleanup Untested
### Gap Location
- `src/renderer/lib/eventDispatchers.ts:7`

### Why It Matters
- This module multiplexes global IPC listeners to per-session handlers. Bugs here can cause leaks, dropped events, or cross-session contamination.

### Tests To Add
- Add `tests/unit/renderer/lib/eventDispatchers.test.ts`.
- Assert only one global IPC listener is installed per channel regardless of subscriber count.
- Assert session scoping: events go only to matching session handlers.
- Assert multi-subscriber fan-out within same session.
- Assert unsubscribe removes handler and eventually removes global listener when last handler is gone.
- Assert no callback occurs after unsubscribe.

## Gap 7 (`P1`) App-Level Integration (Keyboard + Help + Session Focus) Untested
### Gap Location
- `src/renderer/App.tsx:10`
- `src/renderer/App.tsx:89`
- `src/renderer/App.tsx:133`

### Why It Matters
- Critical user interactions are composed at app level and not covered by isolated component tests.

### Tests To Add
- Add `tests/unit/renderer/App.test.tsx`.
- Mock session context hooks to control session list and active session.
- Assert:
  - `TabBar` and active `Session` rendering logic.
  - empty state when no sessions.
  - `Ctrl+?` opens help overlay.
  - `Escape` closes help overlay.
  - `Ctrl+Tab`/`Ctrl+Shift+Tab` updates active session and calls focus handoff.
  - `Ctrl+W` closes active session route.

## Gap 8 (`P1`) Diff/Monaco Integration and Pooling Behavior Partially Covered
### Gap Location
- `src/renderer/components/diff/MonacoDiffEditor.tsx:15`
- `src/renderer/components/diff/DiffView.tsx:138`
- `src/renderer/components/diff/DiffPanel.tsx:51`

### Why It Matters
- Performance and UX behavior depends on one-time Monaco config, pooled editor reuse/eviction, and view-mode switching.

### Tests To Add
- Add `tests/unit/renderer/components/MonacoDiffEditor.test.tsx`.
  - Assert `loader.config` and `defineTheme` called once across repeated renders.
  - Assert `DiffEditor` receives expected theme/options props.
- Expand `tests/unit/renderer/components/DiffView.test.tsx`:
  - Assert pool size cap (`POOL_CAP`) eviction behavior when > 8 files selected.
  - Assert active editor visibility toggling (`opacity/pointerEvents/zIndex`) on file switch.
  - Assert `viewMode` prop changes alter editor options mode.
- Expand `tests/unit/renderer/components/DiffPanel.test.tsx`:
  - Assert mode toggle cycles `auto -> unified -> split`.
  - Assert copy path / copy filename actions call clipboard with expected values.
  - Assert resize handlers clamp width and height boundaries.

## Gap 9 (`P2`) Security Utility Edges Not Explicitly Tested
### Gap Location
- `src/main/security/path-utils.ts:3`
- `src/main/security/trusted-renderer.ts:19`

### Why It Matters
- These helpers are foundational to traversal and origin checks used by privileged paths.

### Tests To Add
- Add `tests/unit/main/security/path-utils.test.ts`.
  - Assert `pathsEqual` normalization behavior for relative/absolute and separator differences.
  - Assert `isPathInside` handles exact match, child path, sibling path, and traversal attempts.
  - Add platform-conditional expectations for Windows case-insensitive behavior.
- Expand `tests/unit/main/security/trusted-renderer.test.ts`:
  - Dev server pathname prefix acceptance/rejection.
  - Invalid URL handling.
  - File protocol strictness and malformed file URLs.

## Gap 10 (`P2`) SessionContext Edge Paths Need More Direct Assertions
### Gap Location
- `src/renderer/context/SessionContext.tsx:45`
- `src/renderer/context/SessionContext.tsx:194`
- `src/renderer/context/SessionContext.tsx:207`

### Why It Matters
- Core behavior is tested, but several branch paths remain unverified (fallback/defaults, visibility refresh semantics, onCwdChanged updates).

### Tests To Add
- Extend `tests/unit/renderer/hooks/useSessions.test.tsx`:
  - `getHomeDir` reject path falls back to `/home`.
  - `document.hidden` prevents polling updates.
  - `visibilitychange` triggers refresh when visible.
  - `onCwdChanged` updates `sessionCwds`, `sessionGitRoots`, and session display name.
  - Ensure no unnecessary state churn when values are unchanged.

## Coverage Config Follow-Up (Planning Item)
### Gap Location
- `vitest.config.ts:16`

### Why It Matters
- Excluding `src/main/**/*` from coverage can hide risk and distort signal.

### Planned Adjustment
- Revisit coverage filters after adding main-process tests.
- Target separate thresholds by domain:
  - `src/main/security/*` highest threshold.
  - IPC modules high threshold.
  - renderer components moderate threshold with behavior-focused assertions.

## Suggested Execution Order
1. `P0`: Main index + IPC modules + preload bridge tests.
2. `P0/P1`: Strengthen E2E assertions to eliminate no-op checks.
3. `P1`: `useTerminal`, event dispatchers, app-level integration tests.
4. `P1/P2`: Diff/Monaco pooling and UI interaction hardening.
5. `P2`: security utility edge cases and SessionContext branch completion.
6. Re-evaluate coverage config and set thresholds once above items land.

## Definition of Done For This Plan
- Every listed gap has at least one concrete test file and scenario implemented.
- No remaining E2E tests with trivial always-pass assertions.
- Main-process trust boundaries (origin, params, lifecycle cleanup) covered by direct tests.
- Coverage report includes and meaningfully represents main-process code.
