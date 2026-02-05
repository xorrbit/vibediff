# vibediff - Detailed Implementation Plan

A multiplatform terminal emulator with integrated code review/diff panel for Claude Code workflows.

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Project Scaffolding | ✅ COMPLETE | All configs, dependencies, project structure |
| Phase 2: Core Layout Components | ✅ COMPLETE | TabBar, Tab, ResizableSplit, Session |
| Phase 3: Terminal Integration | ✅ COMPLETE | xterm.js, node-pty, shell detection |
| Phase 4: Git Integration | ✅ COMPLETE | simple-git, file watcher, diff content |
| Phase 5: Diff Panel UI | ✅ COMPLETE | FileList, DiffView with Monaco |
| Phase 6: Session Management | ✅ COMPLETE | Directory picker, keyboard shortcuts |
| Phase 7: Polish and Packaging | ✅ COMPLETE | Menu, help overlay, icons, tests |

### Commits
1. `00d002b` - Add detailed implementation plan
2. `5f5fa4e` - Implement complete project scaffold (Phase 1-5)
3. `4aebd68` - Add keyboard shortcuts and application menu (Phase 6-7 partial)
4. `a4d3838` - Add test infrastructure and app icons (Phase 7 complete)

### Test Infrastructure
- **Unit Tests**: 40 tests passing (Vitest + React Testing Library)
  - `useResizable.test.ts` - 9 tests
  - `useSessions.test.tsx` - 12 tests
  - `TabBar.test.tsx` - 8 tests
  - `FileList.test.tsx` - 11 tests
- **E2E Tests**: Playwright + Electron configured
  - `app.spec.ts` - App launch tests
  - `tabs.spec.ts` - Tab management tests
  - `terminal.spec.ts` - Terminal functionality tests
  - `diff.spec.ts` - Diff panel tests

### App Icons
- SVG source: `resources/icon.svg`
- PNG icons: 16, 32, 48, 64, 128, 256, 512, 1024px
- Windows ICO: `resources/icon.ico`
- macOS ICNS: Generate on macOS with `scripts/generate-icons.sh`

### Packaging Status
- ✅ Linux ARM64 AppImage: `release/vibediff-0.1.0-arm64.AppImage` (125MB)
- ⚠️ Linux x64: Requires x64 build machine (node-pty cross-compilation issue)
- ⚠️ Windows: Requires Windows or cross-compilation setup
- ⚠️ macOS: Requires macOS (also for .icns icon generation)

### Commands
```bash
# Development
npm run dev          # Start dev server with hot reload

# Testing
npm run test:unit    # Run 40 unit tests
npm run test:e2e     # Run Playwright E2E tests (requires built app)

# Building
npm run build        # Compile TypeScript and bundle

# Packaging
npm run package:linux   # Build Linux packages
npm run package:mac     # Build macOS packages (on macOS)
npm run package:win     # Build Windows packages

# Icon Generation
./scripts/generate-icons.sh  # Generate PNGs and ICO from SVG
```

### Remaining Work
- [ ] Manual testing checklist (see bottom of PLAN.md)
- [ ] macOS .icns generation (run `scripts/generate-icons.sh` on macOS)
- [ ] Test on Windows and macOS build machines

---

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Electron 28+ | Cross-platform desktop app |
| Language | TypeScript 5.3+ | Type safety |
| UI | React 18 | Component-based UI |
| Styling | Tailwind CSS 3.4 | Utility-first styling |
| Terminal | xterm.js 5.3 | Terminal emulator |
| PTY | node-pty 1.0 | Pseudo-terminal for shell |
| Code View | Monaco Editor 0.45 | Diff rendering |
| Git | simple-git 3.22 | Git operations |
| File Watching | chokidar 3.5 | FS change detection |
| Build Tool | Vite 5 | Fast dev server + bundling |
| Packaging | electron-builder 24 | Cross-platform installers |
| Testing | Vitest + Playwright | Unit + E2E tests |

---

## Project Structure

```
vibediff/
├── PLAN.md                      # This plan
├── package.json
├── tsconfig.json
├── tsconfig.node.json           # Config for main process
├── vite.config.ts               # Vite config for renderer
├── vite.main.config.ts          # Vite config for main process
├── vite.preload.config.ts       # Vite config for preload
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.json
├── .gitignore
├── .eslintrc.json
│
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window management
│   │   ├── ipc/
│   │   │   ├── index.ts         # IPC handler registration
│   │   │   ├── pty.ts           # PTY IPC handlers
│   │   │   ├── git.ts           # Git IPC handlers
│   │   │   └── fs.ts            # File system IPC handlers
│   │   ├── services/
│   │   │   ├── shell.ts         # Shell detection
│   │   │   ├── git.ts           # Git operations via simple-git
│   │   │   ├── pty-manager.ts   # PTY lifecycle management
│   │   │   └── watcher.ts       # File system watcher
│   │   └── utils/
│   │       └── platform.ts      # Platform-specific utilities
│   │
│   ├── renderer/                # React app
│   │   ├── index.html
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Root component
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── Tab.tsx
│   │   │   │   └── ResizableSplit.tsx
│   │   │   ├── terminal/
│   │   │   │   └── Terminal.tsx
│   │   │   ├── diff/
│   │   │   │   ├── DiffPanel.tsx
│   │   │   │   ├── FileList.tsx
│   │   │   │   ├── FileListItem.tsx
│   │   │   │   └── DiffView.tsx
│   │   │   └── common/
│   │   │       └── EmptyState.tsx
│   │   ├── hooks/
│   │   │   ├── useTerminal.ts
│   │   │   ├── useGitDiff.ts
│   │   │   ├── useSessions.ts
│   │   │   ├── useResizable.ts
│   │   │   └── useFileWatcher.ts
│   │   ├── context/
│   │   │   └── SessionContext.tsx
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── lib/
│   │   │   ├── ipc.ts           # IPC client wrapper
│   │   │   └── constants.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── preload/
│   │   └── index.ts             # Context bridge
│   │
│   └── shared/                  # Shared between main/renderer
│       └── types.ts             # IPC message types
│
├── tests/
│   ├── unit/
│   │   ├── main/
│   │   │   ├── shell.test.ts
│   │   │   ├── git.test.ts
│   │   │   └── watcher.test.ts
│   │   └── renderer/
│   │       ├── hooks/
│   │       │   ├── useSessions.test.ts
│   │       │   └── useResizable.test.ts
│   │       └── components/
│   │           ├── TabBar.test.tsx
│   │           ├── FileList.test.tsx
│   │           └── Terminal.test.tsx
│   ├── e2e/
│   │   ├── app.spec.ts          # Basic app launch
│   │   ├── terminal.spec.ts     # Terminal functionality
│   │   ├── tabs.spec.ts         # Tab management
│   │   └── diff.spec.ts         # Diff panel functionality
│   └── fixtures/
│       └── test-repo/           # Git repo fixture for tests
│
└── resources/
    ├── icon.png                 # 1024x1024 app icon
    ├── icon.icns                # macOS icon
    └── icon.ico                 # Windows icon
```

---

## Task List

### Phase 1: Project Scaffolding

#### Task 1.1: Initialize Project
**Description**: Create the base project structure with npm, TypeScript, and basic configuration files.

**Steps**:
1. Create project directory and initialize npm
2. Install TypeScript and configure `tsconfig.json` files
3. Create directory structure as outlined above
4. Add `.gitignore` with Node, Electron, and build artifacts
5. Initialize git repository

**Acceptance Criteria**:
- [ ] `npm install` completes without errors
- [ ] `tsc --noEmit` passes with no errors
- [ ] Directory structure matches the plan
- [ ] Git repository initialized with initial commit

**Test Coverage**: N/A (setup task)

---

#### Task 1.2: Configure Electron with Vite
**Description**: Set up Electron main process with Vite for fast development.

**Steps**:
1. Install electron, vite, and related plugins
2. Create `vite.main.config.ts` for main process bundling
3. Create `vite.preload.config.ts` for preload script
4. Create `vite.config.ts` for renderer process
5. Create minimal `src/main/index.ts` that creates a BrowserWindow
6. Create minimal `src/preload/index.ts` with context bridge stub
7. Create minimal `src/renderer/index.html` and `main.tsx`
8. Add npm scripts: `dev`, `build`, `preview`

**Acceptance Criteria**:
- [ ] `npm run dev` launches Electron window with React app
- [ ] Hot reload works for renderer changes
- [ ] Main process restarts on changes
- [ ] Window shows "Hello World" from React

**Test Coverage**:
- E2E: `app.spec.ts` - App launches and shows window

---

#### Task 1.3: Configure React with Tailwind
**Description**: Set up React 18 with Tailwind CSS for styling.

**Steps**:
1. Install React, ReactDOM, and type definitions
2. Install Tailwind, PostCSS, Autoprefixer
3. Create `tailwind.config.js` with dark mode enabled
4. Create `postcss.config.js`
5. Create `src/renderer/styles/globals.css` with Tailwind directives
6. Set up basic dark theme colors in Tailwind config
7. Update `main.tsx` to import global styles

**Acceptance Criteria**:
- [ ] Tailwind utility classes work in components
- [ ] Dark mode is the default
- [ ] Custom color palette defined for terminal aesthetic
- [ ] No CSS build errors

**Test Coverage**: N/A (configuration task)

---

#### Task 1.4: Configure ESLint and Prettier
**Description**: Set up linting and formatting for code quality.

**Steps**:
1. Install ESLint with TypeScript and React plugins
2. Install Prettier and eslint-config-prettier
3. Create `.eslintrc.json` with appropriate rules
4. Create `.prettierrc`
5. Add npm scripts: `lint`, `lint:fix`, `format`

**Acceptance Criteria**:
- [ ] `npm run lint` runs without config errors
- [ ] ESLint catches TypeScript issues
- [ ] Prettier formats code consistently
- [ ] No conflicts between ESLint and Prettier

**Test Coverage**: N/A (tooling task)

---

#### Task 1.5: Configure Testing Framework
**Description**: Set up Vitest for unit tests and Playwright for E2E tests.

**Steps**:
1. Install Vitest with React testing library
2. Install Playwright for Electron
3. Create `vitest.config.ts`
4. Create `playwright.config.ts` for Electron testing
5. Create test directory structure
6. Write smoke test for each test type
7. Add npm scripts: `test`, `test:unit`, `test:e2e`

**Acceptance Criteria**:
- [ ] `npm run test:unit` runs and passes
- [ ] `npm run test:e2e` launches app and runs basic test
- [ ] Test coverage reporting works
- [ ] Tests run in CI-friendly mode

**Test Coverage**:
- Unit: Smoke test passes
- E2E: App launch test passes

---

### Phase 2: Core Layout Components

#### Task 2.1: Implement TabBar Component
**Description**: Create the tab bar UI for managing multiple sessions.

**Steps**:
1. Create `Tab.tsx` - individual tab with title and close button
2. Create `TabBar.tsx` - container with tabs and "+" button
3. Style with Tailwind for dark theme
4. Add hover and active states
5. Handle tab overflow (scrollable if many tabs)

**Acceptance Criteria**:
- [ ] Tabs display with session name/directory
- [ ] Active tab is visually distinct
- [ ] Close button appears on hover
- [ ] "+" button visible and styled
- [ ] Tabs scroll horizontally when overflowing

**Test Coverage**:
- Unit: `TabBar.test.tsx`
  - Renders correct number of tabs
  - Calls onTabSelect when tab clicked
  - Calls onTabClose when close button clicked
  - Calls onNewTab when + clicked
  - Shows active tab styling

---

#### Task 2.2: Implement ResizableSplit Component
**Description**: Create a horizontally split pane with draggable divider.

**Steps**:
1. Create `useResizable.ts` hook for drag logic
2. Create `ResizableSplit.tsx` component
3. Implement mouse drag handling
4. Implement minimum width constraints (min 20% each side)
5. Persist ratio during resize
6. Add cursor feedback during drag

**Acceptance Criteria**:
- [ ] Two panes display side by side
- [ ] Divider is draggable
- [ ] Ratio updates smoothly during drag
- [ ] Minimum widths enforced (neither pane < 20%)
- [ ] Cursor changes to `col-resize` on divider
- [ ] Default ratio is 60/40

**Test Coverage**:
- Unit: `useResizable.test.ts`
  - Returns correct initial ratio
  - Updates ratio on drag
  - Enforces minimum constraints
  - Handles edge cases (drag outside bounds)

---

#### Task 2.3: Implement Session Container
**Description**: Create the Session component that holds terminal + diff panel.

**Steps**:
1. Create `Session.tsx` component
2. Integrate ResizableSplit with placeholder children
3. Pass session data to children
4. Handle session lifecycle (mount/unmount)

**Acceptance Criteria**:
- [ ] Session renders with split layout
- [ ] Terminal placeholder on left (60%)
- [ ] Diff panel placeholder on right (40%)
- [ ] Session receives and passes down session data

**Test Coverage**:
- Unit: `Session.test.tsx`
  - Renders both panes
  - Passes correct props to children

---

#### Task 2.4: Implement App Layout and Session Context
**Description**: Create the main App component and session state management.

**Steps**:
1. Create `SessionContext.tsx` with session state
2. Create `useSessions.ts` hook
3. Implement session CRUD operations
4. Wire up App.tsx with TabBar and Session
5. Handle empty state (no sessions)

**Acceptance Criteria**:
- [ ] App shows TabBar at top, Session below
- [ ] Creating new session adds tab and switches to it
- [ ] Closing session removes tab
- [ ] Closing last session shows empty state or creates new one
- [ ] Tab switching changes displayed session

**Test Coverage**:
- Unit: `useSessions.test.ts`
  - Creates session with unique ID
  - Removes session by ID
  - Tracks active session correctly
  - Handles edge cases (close active, close last)

---

### Phase 3: Terminal Integration

#### Task 3.1: Implement Shell Detection Service
**Description**: Create a service that detects the user's default shell.

**Steps**:
1. Create `src/main/services/shell.ts`
2. Implement macOS/Linux detection via `$SHELL` and `/etc/passwd`
3. Implement Windows detection (PowerShell, cmd fallback)
4. Return shell path and shell name
5. Handle edge cases (missing shell, invalid path)

**Acceptance Criteria**:
- [ ] Returns correct shell on macOS (`/bin/zsh` or `/bin/bash`)
- [ ] Returns correct shell on Linux
- [ ] Returns PowerShell path on Windows
- [ ] Falls back gracefully if detection fails
- [ ] Returns both shell path and human-readable name

**Test Coverage**:
- Unit: `shell.test.ts`
  - Mocks environment variables
  - Tests macOS detection
  - Tests Linux detection
  - Tests Windows detection
  - Tests fallback behavior

---

#### Task 3.2: Implement PTY Manager
**Description**: Create a service that manages PTY instances for each session.

**Steps**:
1. Install `node-pty`
2. Create `src/main/services/pty-manager.ts`
3. Implement `spawn(sessionId, cwd, shell)` - creates PTY
4. Implement `write(sessionId, data)` - sends input
5. Implement `resize(sessionId, cols, rows)` - resizes terminal
6. Implement `kill(sessionId)` - terminates PTY
7. Handle PTY events (data, exit)
8. Clean up on session close

**Acceptance Criteria**:
- [ ] PTY spawns with correct shell
- [ ] PTY starts in correct working directory
- [ ] Input is written to PTY
- [ ] Output is received from PTY
- [ ] Resize changes terminal dimensions
- [ ] Kill terminates process cleanly
- [ ] No zombie processes after cleanup

**Test Coverage**:
- Unit: `pty-manager.test.ts`
  - Spawns PTY with correct args
  - Routes input correctly
  - Handles resize
  - Cleans up on kill
  - (Note: Full PTY testing is integration-level)

---

#### Task 3.3: Implement PTY IPC Handlers
**Description**: Set up IPC communication between main and renderer for PTY.

**Steps**:
1. Create `src/main/ipc/pty.ts`
2. Define IPC channels in `src/shared/types.ts`
3. Register handlers for: spawn, input, resize, kill
4. Set up event forwarding for PTY output
5. Update preload script with PTY API
6. Create `src/renderer/lib/ipc.ts` wrapper

**Acceptance Criteria**:
- [ ] Renderer can request PTY spawn
- [ ] Renderer receives PTY output
- [ ] Renderer can send input to PTY
- [ ] Renderer can request resize
- [ ] Renderer can request kill
- [ ] Type safety across IPC boundary

**Test Coverage**:
- E2E: `terminal.spec.ts` (partial - basic IPC works)

---

#### Task 3.4: Implement Terminal Component
**Description**: Create the xterm.js terminal component.

**Steps**:
1. Install xterm, xterm-addon-fit, xterm-addon-web-links
2. Create `useTerminal.ts` hook
3. Create `Terminal.tsx` component
4. Initialize xterm with dark theme
5. Connect to PTY via IPC
6. Handle resize with fit addon
7. Set up web links addon
8. Handle copy/paste

**Acceptance Criteria**:
- [ ] Terminal renders in container
- [ ] Terminal spawns shell on mount
- [ ] Typing sends input to shell
- [ ] Shell output displays in terminal
- [ ] Terminal resizes with container
- [ ] Links are clickable
- [ ] Copy/paste works (Cmd/Ctrl+C/V in terminal context)
- [ ] Terminal cleans up on unmount

**Test Coverage**:
- Unit: `Terminal.test.tsx`
  - Mounts xterm instance
  - Calls IPC spawn on mount
  - Handles resize
  - Cleans up on unmount
- E2E: `terminal.spec.ts`
  - Types command and sees output
  - Terminal persists across tab switch

---

#### Task 3.5: Set Up Terminal Theming
**Description**: Configure terminal colors for dark theme aesthetic.

**Steps**:
1. Define terminal color scheme (background, foreground, ANSI colors)
2. Match Monaco editor theme colors for consistency
3. Configure xterm theme option
4. Ensure good contrast and readability
5. Test with common CLI outputs (ls, git, etc.)

**Acceptance Criteria**:
- [ ] Terminal has dark background (#1e1e1e or similar)
- [ ] Text is readable with good contrast
- [ ] ANSI colors display correctly
- [ ] Cursor is visible
- [ ] Selection is visible

**Test Coverage**: Manual visual testing

---

### Phase 4: Git Integration

#### Task 4.1: Implement Git Service
**Description**: Create a service for git operations using simple-git.

**Steps**:
1. Install `simple-git`
2. Create `src/main/services/git.ts`
3. Implement `getMainBranch(dir)` - detect main/master/default
4. Implement `getChangedFiles(dir, baseBranch)` - list changed files
5. Implement `getFileDiff(dir, filePath, baseBranch)` - get unified diff
6. Implement `getFileContent(dir, filePath, ref)` - get file at ref
7. Handle non-git directories gracefully
8. Handle errors (not a repo, branch not found, etc.)

**Acceptance Criteria**:
- [ ] Correctly detects main branch (tries main, then master)
- [ ] Returns list of changed files with status (A/M/D)
- [ ] Returns accurate diff content
- [ ] Returns file content at specific ref
- [ ] Returns empty/null for non-git directories
- [ ] Throws meaningful errors for git failures

**Test Coverage**:
- Unit: `git.test.ts`
  - Uses test fixture repo
  - Tests getMainBranch with various configs
  - Tests getChangedFiles returns correct files
  - Tests getFileDiff returns valid diff
  - Tests getFileContent returns correct content
  - Tests error handling for non-repo

---

#### Task 4.2: Implement File Watcher Service
**Description**: Create a service that watches directories for file changes.

**Steps**:
1. Install `chokidar`
2. Create `src/main/services/watcher.ts`
3. Implement `watch(sessionId, dir)` - start watching
4. Implement `unwatch(sessionId)` - stop watching
5. Configure to ignore `.git`, `node_modules`, etc.
6. Debounce change events (300ms)
7. Emit events to renderer via IPC

**Acceptance Criteria**:
- [ ] Detects file creates, modifies, deletes
- [ ] Ignores `.git` directory changes
- [ ] Ignores `node_modules`
- [ ] Debounces rapid changes
- [ ] Cleans up watcher on unwatch
- [ ] Handles directory that doesn't exist

**Test Coverage**:
- Unit: `watcher.test.ts`
  - Emits events on file change
  - Debounces multiple rapid changes
  - Ignores configured patterns
  - Cleans up properly

---

#### Task 4.3: Implement Git and FS IPC Handlers
**Description**: Set up IPC communication for git and file system operations.

**Steps**:
1. Create `src/main/ipc/git.ts`
2. Create `src/main/ipc/fs.ts`
3. Define IPC channels in shared types
4. Register handlers for git operations
5. Register handlers for watch start/stop
6. Set up change event forwarding
7. Update preload script

**Acceptance Criteria**:
- [ ] Renderer can request changed files
- [ ] Renderer can request file diff
- [ ] Renderer can start/stop watching
- [ ] Renderer receives file change events
- [ ] All operations return typed responses

**Test Coverage**: Covered by E2E tests

---

#### Task 4.4: Implement useGitDiff Hook
**Description**: Create a hook that manages git diff state in the renderer.

**Steps**:
1. Create `src/renderer/hooks/useGitDiff.ts`
2. Fetch changed files on mount
3. Subscribe to file change events
4. Refresh on file changes (debounced)
5. Track selected file
6. Fetch diff content for selected file
7. Handle loading and error states

**Acceptance Criteria**:
- [ ] Loads changed files on mount
- [ ] Refreshes when files change
- [ ] Tracks selected file
- [ ] Provides diff content for selected file
- [ ] Exposes loading state
- [ ] Handles errors gracefully

**Test Coverage**:
- Unit: `useGitDiff.test.ts`
  - Mocks IPC layer
  - Tests initial load
  - Tests refresh on event
  - Tests file selection
  - Tests error handling

---

### Phase 5: Diff Panel UI

#### Task 5.1: Implement FileList Component
**Description**: Create the component that displays changed files.

**Steps**:
1. Create `FileListItem.tsx` - single file row
2. Create `FileList.tsx` - container with file items
3. Show file path (relative to repo root)
4. Show status indicator (color-coded: green=added, yellow=modified, red=deleted)
5. Handle file selection
6. Show empty state when no changes

**Acceptance Criteria**:
- [ ] Lists all changed files
- [ ] Shows file status with color indicator
- [ ] Clicking file selects it
- [ ] Selected file is highlighted
- [ ] Shows "No changes" when file list empty
- [ ] Scrollable when many files

**Test Coverage**:
- Unit: `FileList.test.tsx`
  - Renders correct number of files
  - Shows correct status colors
  - Calls onSelect when clicked
  - Shows empty state

---

#### Task 5.2: Implement DiffView Component
**Description**: Create the Monaco-based diff viewer.

**Steps**:
1. Install `@monaco-editor/react`
2. Create `DiffView.tsx` component
3. Configure Monaco for diff mode
4. Set dark theme to match terminal
5. Load original (base branch) and modified (working copy)
6. Configure as read-only
7. Handle loading state
8. Handle file not found (new files)

**Acceptance Criteria**:
- [ ] Shows unified diff with syntax highlighting
- [ ] Added lines highlighted green
- [ ] Removed lines highlighted red
- [ ] Syntax highlighting matches file type
- [ ] Scroll syncs between sides (Monaco default)
- [ ] Read-only (no editing)
- [ ] Shows loading indicator while fetching
- [ ] Handles new files (no original)
- [ ] Handles deleted files (no modified)

**Test Coverage**:
- Unit: `DiffView.test.tsx`
  - Mounts Monaco editor
  - Configures read-only
  - Shows correct theme
- E2E: `diff.spec.ts`
  - Shows diff content for selected file

---

#### Task 5.3: Implement DiffPanel Container
**Description**: Create the container that holds FileList and DiffView.

**Steps**:
1. Create `DiffPanel.tsx`
2. Layout: FileList on top (fixed height), DiffView below (flex)
3. Wire up useGitDiff hook
4. Pass selected file to DiffView
5. Handle no-repo state
6. Handle loading state

**Acceptance Criteria**:
- [ ] FileList shows at top
- [ ] DiffView fills remaining space
- [ ] Selecting file updates DiffView
- [ ] Shows message when not in git repo
- [ ] Shows loading state appropriately

**Test Coverage**:
- Unit: Component integration tested via E2E
- E2E: `diff.spec.ts`
  - Full diff panel workflow

---

#### Task 5.4: Integrate Diff Panel with Session
**Description**: Connect the diff panel to the session and wire up file watching.

**Steps**:
1. Update Session.tsx to use DiffPanel
2. Start file watcher when session mounts
3. Stop file watcher when session unmounts
4. Pass session cwd to diff panel
5. Ensure tab switching preserves state

**Acceptance Criteria**:
- [ ] Diff panel shows in right pane
- [ ] File watcher starts on session mount
- [ ] File watcher stops on session unmount
- [ ] Changes update diff panel automatically
- [ ] Switching tabs preserves file list

**Test Coverage**:
- E2E: `diff.spec.ts`
  - Changes to file update diff view
  - Tab switch preserves state

---

### Phase 6: Session Management

#### Task 6.1: Implement New Session Dialog
**Description**: Create UI for starting a new session with directory selection.

**Steps**:
1. Create directory picker using Electron dialog
2. Add IPC handler for opening directory dialog
3. Wire up "+" button to open dialog
4. Create session with selected directory
5. Default to home directory if cancelled

**Acceptance Criteria**:
- [ ] "+" button opens native directory picker
- [ ] Selecting directory creates new session
- [ ] New session opens in selected directory
- [ ] Tab shows directory name
- [ ] Cancel doesn't create session

**Test Coverage**:
- E2E: `tabs.spec.ts`
  - Opening new tab (with mock dialog)

---

#### Task 6.2: Implement Tab Keyboard Shortcuts
**Description**: Add keyboard shortcuts for tab management.

**Steps**:
1. Set up keyboard event listeners
2. Implement Cmd/Ctrl+T: new tab
3. Implement Cmd/Ctrl+W: close current tab
4. Implement Cmd/Ctrl+1-9: switch to tab by number
5. Implement Cmd/Ctrl+Tab: next tab
6. Implement Cmd/Ctrl+Shift+Tab: previous tab

**Acceptance Criteria**:
- [ ] Cmd/Ctrl+T opens new tab
- [ ] Cmd/Ctrl+W closes current tab
- [ ] Number shortcuts switch tabs
- [ ] Tab cycling works
- [ ] Shortcuts work when terminal focused

**Test Coverage**:
- E2E: `tabs.spec.ts`
  - Keyboard shortcuts work

---

#### Task 6.3: Polish Tab Bar UX
**Description**: Improve tab bar usability and appearance.

**Steps**:
1. Show full path on tab hover (tooltip)
2. Truncate long directory names in tab
3. Add favicon/icon to tabs
4. Animate tab open/close
5. Handle tab reordering (drag and drop) - optional for v1

**Acceptance Criteria**:
- [ ] Tooltip shows full path
- [ ] Long names truncated with ellipsis
- [ ] Tabs have consistent width
- [ ] Smooth transitions on tab changes

**Test Coverage**: Manual visual testing

---

### Phase 7: Polish and Packaging

#### Task 7.1: Implement Keyboard Shortcuts Legend
**Description**: Add a help panel or tooltip showing available shortcuts.

**Steps**:
1. Create shortcuts data structure
2. Add Cmd/Ctrl+? shortcut to show help
3. Create simple overlay/modal with shortcuts list
4. Style consistently with app theme

**Acceptance Criteria**:
- [ ] Help shows all available shortcuts
- [ ] Styled consistently
- [ ] Dismissable with Escape or click outside

**Test Coverage**: Manual testing

---

#### Task 7.2: Add Application Menu
**Description**: Create native application menu for macOS/Windows/Linux.

**Steps**:
1. Create menu template in main process
2. Add File menu (New Tab, Close Tab, Quit)
3. Add Edit menu (Copy, Paste, Select All)
4. Add View menu (Reload, DevTools in dev mode)
5. Add Help menu (About, Shortcuts)
6. Wire up menu items to actions

**Acceptance Criteria**:
- [ ] Menu bar appears on all platforms
- [ ] Menu items trigger correct actions
- [ ] Keyboard shortcuts shown in menu
- [ ] macOS app menu is correct (Vibediff, not Electron)

**Test Coverage**: Manual testing

---

#### Task 7.3: Configure App Icons
**Description**: Create and configure application icons for all platforms.

**Steps**:
1. Create icon design (1024x1024 PNG)
2. Generate macOS .icns
3. Generate Windows .ico
4. Generate Linux icons (various sizes)
5. Configure electron-builder to use icons

**Acceptance Criteria**:
- [ ] App shows custom icon in dock/taskbar
- [ ] Window title bar shows icon
- [ ] Installer shows icon

**Test Coverage**: Manual testing

---

#### Task 7.4: Configure Electron Builder
**Description**: Set up cross-platform packaging and distribution.

**Steps**:
1. Create `electron-builder.json` config
2. Configure macOS build (.dmg, universal binary)
3. Configure Windows build (.exe installer)
4. Configure Linux build (.AppImage, .deb)
5. Add npm scripts: `package`, `package:mac`, `package:win`, `package:linux`
6. Test builds on each platform

**Acceptance Criteria**:
- [ ] `npm run package:mac` produces working .dmg
- [ ] `npm run package:win` produces working .exe
- [ ] `npm run package:linux` produces working .AppImage
- [ ] App opens and functions on each platform
- [ ] Icons and metadata correct

**Test Coverage**:
- Manual installation testing on each platform

---

#### Task 7.5: Final Testing and Bug Fixes
**Description**: Comprehensive testing across all platforms.

**Steps**:
1. Run full E2E test suite
2. Manual testing on macOS
3. Manual testing on Windows
4. Manual testing on Linux (Ubuntu)
5. Fix any platform-specific bugs
6. Performance testing (memory, CPU)
7. Fix any memory leaks

**Acceptance Criteria**:
- [ ] All E2E tests pass
- [ ] Manual test checklist complete on all platforms
- [ ] No memory leaks after extended use
- [ ] Reasonable memory footprint (<500MB)
- [ ] Terminal is responsive

**Test Coverage**:
- Full E2E suite
- Manual test checklist (see below)

---

## Manual Test Checklist

### App Launch
- [ ] App opens without errors
- [ ] Window appears with correct size
- [ ] Dark theme applied

### Tabs
- [ ] First tab created automatically
- [ ] "+" creates new tab with directory picker
- [ ] Clicking tab switches to it
- [ ] Close button closes tab
- [ ] Cmd/Ctrl+T creates new tab
- [ ] Cmd/Ctrl+W closes tab
- [ ] Cmd/Ctrl+1-9 switches tabs
- [ ] Last tab close creates new tab (or shows empty state)

### Terminal
- [ ] Shell spawns correctly (zsh/bash/PowerShell)
- [ ] Typing input works
- [ ] Command output displays
- [ ] Colors render correctly
- [ ] Terminal resizes with pane
- [ ] Copy/paste works
- [ ] Links are clickable
- [ ] Terminal survives tab switch

### Diff Panel
- [ ] Shows "No changes" when clean
- [ ] File list populates when changes exist
- [ ] File status colors correct (A/M/D)
- [ ] Clicking file shows diff
- [ ] Diff has syntax highlighting
- [ ] Added lines green, removed red
- [ ] New files show correctly
- [ ] Deleted files show correctly
- [ ] Changes auto-refresh when files saved

### Layout
- [ ] Panes resize with drag
- [ ] Minimum widths enforced
- [ ] 60/40 default ratio

### Cross-Platform
- [ ] macOS: correct app menu, Cmd shortcuts
- [ ] Windows: correct shortcuts (Ctrl)
- [ ] Linux: correct shortcuts, app menu

---

## Dependencies

```json
{
  "name": "vibediff",
  "version": "0.1.0",
  "description": "Terminal emulator with integrated code review",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "package": "electron-builder",
    "package:mac": "electron-builder --mac",
    "package:win": "electron-builder --win",
    "package:linux": "electron-builder --linux",
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "chokidar": "^3.5.3",
    "monaco-editor": "^0.45.0",
    "node-pty": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "simple-git": "^3.22.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@testing-library/react": "^14.1.0",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "eslint": "^8.55.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "postcss": "^8.4.32",
    "prettier": "^3.1.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.15.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Future Considerations (Post-v1)

- Editable diffs (Monaco supports this)
- Light mode theme toggle
- Terminal color scheme customization
- Collapsible panels
- Session persistence across app restarts
- Split diffs (side-by-side view)
- Staging/unstaging from file list
- Terminal search (scrollback)
- Multiple terminals per tab (splits)
- Git branch switching
- Commit creation from UI
