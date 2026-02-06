# Claude Did What?!

A multiplatform terminal emulator with an integrated code review/diff panel, designed for Claude Code workflows. Another artisanally hand-crafted AI slop project by Andrew Orr.

![Claude Did What?! Screenshot](assets/claudedidwhat.png)

## Features

- **Split-pane layout**: Terminal on the left (50%), diff viewer on the right (50%), with resizable divider
- **Smart tab naming**: Tabs show git branch name, or directory name when on main/master or outside a git repo
- **Multi-tab support**: Manage multiple sessions with keyboard shortcuts
- **Real-time git diff**: Automatically detects and displays file changes with floating overlay file list
- **Monaco-powered diff view**: Syntax highlighting with side-by-side comparison
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Streamlined diff view**: Review AI changes faster so you can pretend you read them

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/xorrbit/claudedidwhat.git
cd claudedidwhat

# Install dependencies (automatically rebuilds native modules for Electron)
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for your platform
npm run package:linux   # Linux (AppImage, deb)
npm run package:mac     # macOS (dmg)
npm run package:win     # Windows (exe)
```

> **Note**: The `postinstall` script automatically rebuilds `node-pty` for Electron. If you encounter native module errors, run `npx @electron/rebuild -f -w node-pty`.

### Pre-built Binaries

Download from the [Releases](https://github.com/xorrbit/claudedidwhat/releases) page.

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` / `Cmd+T` | New tab |
| `Ctrl+W` / `Cmd+W` | Close tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+1-9` / `Cmd+1-9` | Switch to tab by number |
| `Ctrl+?` / `Cmd+?` | Show help overlay |

### Diff Panel

The diff panel on the right side features:
- **Floating file list**: Changed files overlay floats over the terminal with collapsible and resizable panel, color-coded status indicators (Added, Modified, Deleted)
- **File path header**: Full repo-relative path displayed at the top of the diff view
- **Diff viewer**: Click any file to view its diff with syntax highlighting
- **Branch-only changes**: Only shows files changed in your branch, not unrelated changes from main/master
- **Instant file switching**: Diff content is cached for fast navigation between files

Changes are detected in real-time as you edit files. The tab name automatically updates to reflect your current git branch or directory.

### Performance

Optimized for large repositories and multi-tab workflows:

- **Event-driven updates**: Uses native file system events (inotify/FSEvents) instead of polling, so git status only refreshes when files actually change. On WSL2, automatically falls back to lightweight polling to avoid blocking input
- **LRU diff cache**: Recently viewed diffs are cached for instant file switching, with automatic eviction to bound memory usage
- **Visibility-aware**: Background tabs pause file watching and git operations until focused
- **Centralized polling**: Single source for terminal CWD tracking across all tabs, reduced frequency with caching
- **Cached git instances**: SimpleGit instances and repo checks are reused instead of recreated per operation
- **Async I/O**: System calls (like macOS `lsof`) run asynchronously to avoid blocking the main thread
- **Memoized components**: React components use `memo` and CSS-based hover states to minimize re-renders
- **Smart ignores**: Skips `node_modules`, `.git`, `dist`, `build`, and other generated directories

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron |
| Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS + JetBrains Mono |
| Terminal | xterm.js |
| PTY | node-pty |
| Diff View | Monaco Editor |
| Git | simple-git |
| File Watching | chokidar |
| Testing | Vitest + Playwright |

## Development

```bash
# Run development server with hot reload
npm run dev

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
