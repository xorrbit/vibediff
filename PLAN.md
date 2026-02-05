# Performance Optimization Plan

## Critical (High Impact, Easy Fixes)

- [x] **1. Consolidate CWD polling**
  - `DiffPanel.tsx` polls CWD every 2s
  - `SessionContext.tsx` polls all sessions every 2s
  - With N tabs = 2N+ IPC calls every 2 seconds
  - **Fix:** Consolidate into one place, reduce frequency to 5-10s

- [x] **2. Cache SimpleGit instances**
  - `git.ts` creates new `simpleGit()` instance for every operation
  - `getChangedFiles` alone creates 2+ instances
  - **Fix:** Cache instances per directory

- [x] **3. Make execSync async**
  - `pty-manager.ts` uses synchronous `execSync` for macOS `lsof`
  - Can block main thread for up to 1 second
  - **Fix:** Use async `exec` or cache results

## High Priority (Medium Effort)

- [x] **4. Memoize Tab component**
  - Every tab re-renders when any tab changes
  - **Fix:** Wrap in `React.memo()` with custom comparison

- [x] **5. Parallelize git operations**
  - `getChangedFiles` runs 4+ git commands sequentially
  - **Fix:** Use `Promise.all` where safe

- [x] **6. Remove focus delays**
  - Arbitrary 50ms + 100ms setTimeout delays when switching tabs
  - **Fix:** Remove or use requestAnimationFrame

## Medium Priority (Nice to Have)

- [ ] **7. Virtualize FileList**
  - All files rendered at once
  - With 100+ changed files, DOM gets heavy
  - **Fix:** Use react-window or react-virtual

- [x] **8. Tab hover via CSS**
  - useState for hover causes re-render on mouse enter/leave
  - **Fix:** Use CSS `:hover` pseudo-class instead

- [x] **9. Remove dead code**
  - `useFileWatcher.ts` hook is unused (integrated into useGitDiff)
  - **Fix:** Delete the file

---

## Progress Log

### Critical #1: Consolidate CWD polling - DONE
- SessionContext now tracks `sessionCwds` Map with current CWD per session
- DiffPanel uses CWD from context instead of polling separately
- Reduced poll frequency from 2s to 5s
- Added visibility check (no polling when tab hidden)
- Added refresh on visibility change

### Critical #2: Cache SimpleGit instances - DONE
- Added `gitInstances` Map to cache SimpleGit instances per directory
- Added `gitRepoCache` with 30s TTL for isGitRepo checks
- Instances are reused across all git operations

### Critical #3: Make execSync async - DONE
- Changed macOS `lsof` call from `execSync` to async `exec`
- Added 1-second CWD cache to avoid repeated lsof calls
- Linux still uses sync readlinkSync (it's fast enough)

### High Priority #4: Memoize Tab component - DONE
- Wrapped Tab in `React.memo()`
- Replaced `useState` for hover with CSS `group-hover`
- No more re-renders on mouse enter/leave

### High Priority #5: Parallelize git operations - DONE
- `git.status()` and `getMainBranch()` now run in parallel via `Promise.all`

### High Priority #6: Remove focus delays - DONE
- Replaced 50ms and 100ms `setTimeout` with `requestAnimationFrame`
- Tab key uses double rAF to ensure event is fully processed

### Medium Priority #8 & #9 - DONE
- Tab hover now uses CSS instead of state
- Deleted unused `useFileWatcher.ts` (functionality integrated into useGitDiff)
