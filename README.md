# vibediff

A multiplatform terminal emulator with an integrated code review/diff panel, designed for Claude Code workflows.

![vibediff](resources/icon-128.png)

## Features

- **Split-pane layout**: Terminal on the left, diff viewer on the right
- **Multi-tab support**: Manage multiple sessions with keyboard shortcuts
- **Real-time git diff**: Automatically detects and displays file changes
- **Monaco-powered diff view**: Syntax highlighting with side-by-side comparison
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Dark theme**: Easy on the eyes for long coding sessions

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/vibediff.git
cd vibediff

# Install dependencies
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

### Pre-built Binaries

Download from the [Releases](https://github.com/yourusername/vibediff/releases) page.

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

The diff panel on the right side automatically shows:
- List of changed files compared to the main branch
- Color-coded status indicators (Added, Modified, Deleted)
- Click any file to view its diff with syntax highlighting

Changes are detected in real-time as you edit files.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 28 |
| Language | TypeScript 5.3 |
| UI | React 18 |
| Styling | Tailwind CSS 3.4 |
| Terminal | xterm.js 5.3 |
| PTY | node-pty 1.0 |
| Diff View | Monaco Editor 0.45 |
| Git | simple-git 3.22 |
| File Watching | chokidar 3.5 |
| Testing | Vitest + Playwright |

## Development

```bash
# Run development server with hot reload
npm run dev

# Run unit tests (40 tests)
npm run test:unit

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
vibediff/
├── src/
│   ├── main/           # Electron main process
│   │   ├── ipc/        # IPC handlers (pty, git, fs)
│   │   └── services/   # Shell, git, PTY, watcher services
│   ├── renderer/       # React app
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom React hooks
│   │   └── context/    # React context providers
│   ├── preload/        # Electron preload scripts
│   └── shared/         # Shared types
├── tests/
│   ├── unit/           # Vitest unit tests
│   └── e2e/            # Playwright E2E tests
└── resources/          # App icons
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
