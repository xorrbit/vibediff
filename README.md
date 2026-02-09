# Claude Did What?!

AI slop masquerading as a terminal for the post-IDE era. Live diff viewer built in so you can see what your AI agent is doing to your codebase — without ever opening an editor.

Shipped while the tests were still running by Andrew Orr.

![Claude Did What?! Screenshot](assets/screenshot.png)

## Why?

IDEs are on borrowed time. The workflow now is: open Claude Code, tell it what you want, review the changes as they stream in, iterate until you're happy, then commit, push, and open a PR — all without leaving the terminal. Claude Did What?! is the missing piece: a terminal with a built-in diff viewer so you can review, approve, and ship entirely from one window. No VS Code, no JetBrains, no context switching.

## Features

- **Split-pane layout**: Terminal on the left, diff viewer on the right, with a resizable divider — everything in one window
- **Real-time git diff**: File changes appear automatically as they happen, no manual refresh needed
- **Monaco-powered diff view**: Full syntax highlighting with Automatic, Unified, and Split view modes
- **VSCode syntax grammars**: Picks up TextMate grammars from your installed VSCode extensions — if VSCode can highlight it, so can your diffs
- **Instant CWD detection**: Shell integration (bash/zsh/fish) reports directory changes instantly via OSC 7, no polling delay
- **Smart tab naming**: Tabs show your git branch name, or directory name when on main/master
- **Multi-tab support**: Multiple sessions with keyboard shortcuts, or double-click the tab bar to open a new tab
- **AI waiting tab indicator**: Background tabs waiting on Claude/Codex are highlighted with a subtle tint and pulsing icon
- **Terminal context menu**: Right-click for Copy, Paste, Select All, Clear, and "Open tabs for subdirectories"
- **Bulk subdirectory tabs**: Right-click and open a tab for every first-level subdirectory of the current working directory — great for multi-repo workspaces
- **Settings panel**: UI scale (75%–150%), default diff view mode, and automation API toggle — all in one place
- **WebGL-accelerated terminal**: Hardware-accelerated rendering for smooth scrolling and output
- **Cross-platform**: macOS, Windows, and Linux

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

> **Note**: The `postinstall` script automatically rebuilds `node-pty` for Electron. If you encounter native module errors, run `npx electron-rebuild -f -w node-pty`.

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
| `Ctrl+,` / `Cmd+,` | Open settings |

### Diff Panel

The diff panel on the right side features:
- **Floating file list**: Changed files float over the terminal in a collapsible, resizable overlay with color-coded status indicators (Added, Modified, Deleted)
- **File path header**: Repo-relative path with one-click copy buttons for the full path or just the filename
- **Diff viewer**: Click any file to view its diff — toggle between Automatic, Unified, and Split view modes
- **Branch-only changes**: Only shows files changed in your branch, not unrelated changes from main/master
- **Instant file switching**: Diff content is cached so switching between files feels instant

Changes are detected in real-time as files are edited. The tab name automatically updates to reflect your current git branch or directory.

### Performance

Optimized for large repositories and multi-tab workflows:

- **Event-driven updates**: Native file system events (inotify/FSEvents) instead of polling — git status only refreshes when files actually change. Falls back to lightweight polling on WSL2
- **Instant CWD tracking**: Shell integration emits OSC 7 escape sequences on every prompt, so `cd` is detected in milliseconds instead of waiting for a 5-second poll
- **LRU diff cache**: Recently viewed diffs are cached for instant file switching, with automatic eviction to bound memory usage
- **Async large-diff loading**: Uncached diff fetches are deferred by a tick so selection renders immediately, and very large diffs are mounted during idle time (`200k+` combined chars, `40ms` defer, `250ms` idle timeout, `1000ms` Monaco max computation time)
- **Visibility-aware**: Background tabs pause file watching and git operations until focused
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
| Terminal | xterm.js (WebGL) |
| PTY | node-pty |
| Diff View | Monaco Editor + vscode-textmate |
| Git | simple-git |
| File Watching | Native fs.watch |
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

## Security

See [SECURITY.md](SECURITY.md) for the app's security architecture, threat model, and audit history.

## Automation REST API (Optional, Dangerous)

This app includes an optional local REST API that can open a new terminal tab and run arbitrary bootstrap commands. This is designed to allow automation or another AI agent to prepare tabs for you by doing things like adding a new git worktree for an arbitrary branch, copying some files over and then launching claude.

It is intentionally treated as a dangerous feature:
- disabled by default
- localhost only (`127.0.0.1`)
- random port + bearer token
- strict input validation and rate limiting

### 1. Enable It

Edit this config file:

`<userData>/automation/config.json`

Typical `userData` paths:
- Linux: `~/.config/claudedidwhat`
- macOS: `~/Library/Application Support/claudedidwhat`
- Windows: `%APPDATA%/claudedidwhat`

Example config:

```json
{
  "version": 1,
  "enabled": true,
  "allowedRoots": ["/home/you/code"],
  "maxCommands": 25,
  "maxCommandLength": 4096,
  "maxRequestBytes": 262144,
  "requestTimeoutMs": 20000,
  "rateLimitPerMinute": 60
}
```

`cwd` in API requests must be inside one of `allowedRoots`.

### 2. Get Runtime Credentials

When enabled, the app writes:

`<userData>/automation/credentials.json`

Example:

```json
{
  "version": 1,
  "host": "127.0.0.1",
  "port": 48321,
  "token": "<random-token>",
  "createdAt": "2026-02-07T00:00:00.000Z"
}
```

The port/token are generated per app launch.

### 3. Send a Bootstrap Request

Endpoint:

`POST /v1/terminal/bootstrap`

Required headers:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `X-CDW-Client: <your-client-name>`

Request body:

```json
{
  "cwd": "/absolute/path/to/project",
  "commands": [
    "git status",
    "npm test"
  ]
}
```

Example `curl`:

```bash
curl -X POST "http://127.0.0.1:48321/v1/terminal/bootstrap" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "X-CDW-Client: my-script" \
  -d '{"cwd":"/home/you/code/myrepo","commands":["git status","npm test"]}'
```

Success response:

```json
{
  "sessionId": "session-..."
}
```

When enabled, the tab bar shows a small `API` pill indicator.

## License

[MIT](LICENSE.md)
