import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { subscribePtyData, subscribePtyExit } from '../lib/eventDispatchers'
import 'xterm/css/xterm.css'

interface UseTerminalOptions {
  sessionId: string
  cwd: string
  onExit?: () => void
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement>
  focus: () => void
}

// Obsidian Studio terminal theme - refined and warm
const TERMINAL_THEME = {
  background: '#0a0a0b',
  foreground: '#e4e4e7',
  cursor: '#f59e0b',
  cursorAccent: '#0a0a0b',
  selection: 'rgba(245, 158, 11, 0.25)',
  black: '#18181b',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
}

export function useTerminal({ sessionId, cwd, onExit }: UseTerminalOptions): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initializedRef = useRef(false)

  // Fit terminal to container (only after initialization)
  const fitTerminal = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current || !initializedRef.current) return
    if (!terminalRef.current) return

    const rect = terminalRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    try {
      fitAddonRef.current.fit()
      const dims = fitAddonRef.current.proposeDimensions()
      if (dims && dims.cols > 0 && dims.rows > 0) {
        window.electronAPI.pty.resize({
          sessionId,
          cols: dims.cols,
          rows: dims.rows,
        })
      }
    } catch {
      // Ignore fit errors
    }
  }, [sessionId])

  // Focus the terminal
  const focus = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const container = terminalRef.current
    if (!container) return

    let mounted = true
    let terminal: Terminal | null = null
    let fitAddon: FitAddon | null = null
    let resizeObserver: ResizeObserver | null = null
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    let unsubscribeData: (() => void) | null = null
    let unsubscribeExit: (() => void) | null = null
    let unsubscribeContextMenu: (() => void) | null = null
    let handleContextMenu: ((e: MouseEvent) => void) | null = null

    // Wait for container to have dimensions before initializing
    const waitForDimensions = (callback: () => void, attempts = 0) => {
      if (!mounted) return

      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        callback()
      } else if (attempts < 100) {
        // Try again in 20ms, up to 2 seconds
        setTimeout(() => waitForDimensions(callback, attempts + 1), 20)
      } else {
        // Give up waiting, initialize anyway with defaults
        console.warn('Container never got dimensions, initializing anyway')
        callback()
      }
    }

    const initialize = () => {
      if (!mounted) return

      // Create terminal instance with performance optimizations
      terminal = new Terminal({
        theme: TERMINAL_THEME,
        fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", Menlo, Monaco, monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        scrollback: 5000, // Limit scrollback for performance
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 5,
      })

      // Create addons
      fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon((_event, url) => {
        window.electronAPI.shell.openExternal(url)
      })

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      // Store references before opening
      xtermRef.current = terminal
      fitAddonRef.current = fitAddon

      // Open terminal in container
      terminal.open(container)

      // Intercept certain key combinations before xterm handles them
      // This allows our app-level shortcuts to work
      terminal.attachCustomKeyEventHandler((e) => {
        const isMod = e.metaKey || e.ctrlKey
        // Let Ctrl/Cmd+Tab, Ctrl/Cmd+T, Ctrl/Cmd+W bubble up to app handlers
        if (isMod && (e.key === 'Tab' || e.key === 't' || e.key === 'w')) {
          return false // Don't let xterm handle it
        }
        // Let Ctrl/Cmd+1-9 bubble up for tab switching
        if (isMod && e.key >= '1' && e.key <= '9') {
          return false
        }
        return true // Let xterm handle everything else
      })

      // Load WebGL addon for better performance (must be after open)
      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => {
          webglAddon.dispose()
        })
        terminal.loadAddon(webglAddon)
      } catch (e) {
        console.warn('WebGL addon failed to load, using canvas renderer:', e)
      }

      // Right-click context menu
      handleContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        window.electronAPI.terminal.showContextMenu(terminal!.hasSelection())
      }
      container.addEventListener('contextmenu', handleContextMenu)

      // Handle context menu actions from main process
      unsubscribeContextMenu = window.electronAPI.terminal.onContextMenuAction((action) => {
        if (!terminal) return
        switch (action) {
          case 'copy':
            if (terminal.hasSelection()) {
              navigator.clipboard.writeText(terminal.getSelection())
            }
            break
          case 'paste':
            navigator.clipboard.readText().then((text) => {
              if (text) terminal!.paste(text)
            })
            break
          case 'selectAll':
            terminal.selectAll()
            break
          case 'clear':
            terminal.clear()
            break
        }
      })

      // Handle terminal input
      terminal.onData((data) => {
        window.electronAPI.pty.input(sessionId, data)
      })

      // Handle PTY output/exit through shared listeners (single global IPC subscription)
      unsubscribeData = subscribePtyData(sessionId, (data) => {
        if (terminal) {
          terminal.write(data)
        }
      })
      unsubscribeExit = subscribePtyExit(sessionId, () => {
        onExit?.()
      })

      // Get initial dimensions
      let cols = 80
      let rows = 24
      try {
        const dims = fitAddon.proposeDimensions()
        if (dims && dims.cols > 0 && dims.rows > 0) {
          cols = dims.cols
          rows = dims.rows
        }
      } catch {
        // Use defaults
      }

      // Spawn PTY
      window.electronAPI.pty.spawn({
        sessionId,
        cwd,
      }).then(() => {
        if (!mounted) return

        // Mark as initialized
        initializedRef.current = true

        // Resize to actual dimensions
        window.electronAPI.pty.resize({ sessionId, cols, rows })

        // Try to fit after a short delay
        setTimeout(() => {
          if (!mounted || !fitAddon) return
          try {
            fitAddon.fit()
            const dims = fitAddon.proposeDimensions()
            if (dims && dims.cols > 0 && dims.rows > 0) {
              window.electronAPI.pty.resize({
                sessionId,
                cols: dims.cols,
                rows: dims.rows,
              })
            }
          } catch {
            // Ignore
          }

          // Set up resize observer after initialization
          resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout) clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(() => {
              fitTerminal()
            }, 100)
          })
          resizeObserver.observe(container)

          // Focus the terminal so user can start typing immediately
          if (terminal) {
            terminal.focus()
          }
        }, 50)
      }).catch((err) => {
        console.error('Failed to spawn PTY:', err)
        if (terminal) {
          terminal.write(`\r\n\x1b[91mFailed to spawn terminal: ${err.message || err}\x1b[0m\r\n`)
        }
      })
    }

    // Start initialization when dimensions are available
    waitForDimensions(initialize)

    // Cleanup
    return () => {
      mounted = false
      initializedRef.current = false
      if (resizeTimeout) clearTimeout(resizeTimeout)
      if (unsubscribeData) unsubscribeData()
      if (unsubscribeExit) unsubscribeExit()
      if (unsubscribeContextMenu) unsubscribeContextMenu()
      if (handleContextMenu) container.removeEventListener('contextmenu', handleContextMenu)
      if (resizeObserver) resizeObserver.disconnect()
      window.electronAPI.pty.kill(sessionId)
      if (terminal) terminal.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, cwd, fitTerminal])

  return { terminalRef, focus }
}
