import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import 'xterm/css/xterm.css'

interface UseTerminalOptions {
  sessionId: string
  cwd: string
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement>
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

export function useTerminal({ sessionId, cwd }: UseTerminalOptions): UseTerminalReturn {
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
      const webLinksAddon = new WebLinksAddon()

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      // Store references before opening
      xtermRef.current = terminal
      fitAddonRef.current = fitAddon

      // Open terminal in container
      terminal.open(container)

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

      // Handle terminal input
      terminal.onData((data) => {
        window.electronAPI.pty.input(sessionId, data)
      })

      // Handle PTY output
      unsubscribeData = window.electronAPI.pty.onData((sid, data) => {
        if (sid === sessionId && terminal) {
          terminal.write(data)
        }
      })

      // Handle PTY exit
      unsubscribeExit = window.electronAPI.pty.onExit((sid, code) => {
        if (sid === sessionId && terminal) {
          terminal.write(`\r\n\x1b[90mProcess exited with code ${code}\x1b[0m\r\n`)
        }
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
      if (resizeObserver) resizeObserver.disconnect()
      window.electronAPI.pty.kill(sessionId)
      if (terminal) terminal.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, cwd, fitTerminal])

  return { terminalRef }
}
