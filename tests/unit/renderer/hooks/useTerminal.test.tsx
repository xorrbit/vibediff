import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Mock } from 'vitest'

const terminalInstances: any[] = []
const fitAddonInstances: any[] = []

let subscribedPtyDataHandler: ((data: string) => void) | null = null
let subscribedPtyExitHandler: ((code: number) => void) | null = null
let unsubscribePtyData = vi.fn()
let unsubscribePtyExit = vi.fn()

const subscribePtyDataMock = vi.fn((_: string, handler: (data: string) => void) => {
  subscribedPtyDataHandler = handler
  return unsubscribePtyData
})

const subscribePtyExitMock = vi.fn((_: string, handler: (code: number) => void) => {
  subscribedPtyExitHandler = handler
  return unsubscribePtyExit
})

vi.mock('@renderer/lib/eventDispatchers', () => ({
  subscribePtyData: (...args: any[]) => subscribePtyDataMock(...args),
  subscribePtyExit: (...args: any[]) => subscribePtyExitMock(...args),
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function MockTerminal() {
    const instance = {
      open: vi.fn(),
      write: vi.fn(),
      focus: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      loadAddon: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      hasSelection: vi.fn(() => false),
      getSelection: vi.fn(() => ''),
      paste: vi.fn(),
      selectAll: vi.fn(),
      clear: vi.fn(),
    }
    terminalInstances.push(instance)
    return instance
  }),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(function MockFitAddon() {
    const instance = {
      fit: vi.fn(),
      proposeDimensions: vi.fn(() => ({ cols: 120, rows: 40 })),
    }
    fitAddonInstances.push(instance)
    return instance
  }),
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(function MockWebLinksAddon() {
    return {}
  }),
}))

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn(function MockWebglAddon() {
    return {
      onContextLoss: vi.fn(),
      dispose: vi.fn(),
    }
  }),
}))

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

import { useTerminal } from '@renderer/hooks/useTerminal'

function makeRect(width: number, height: number, left = 0, top = 0): DOMRect {
  return {
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function Harness({
  sessionId,
  cwd,
  onExit,
}: {
  sessionId: string
  cwd: string
  onExit?: () => void
}) {
  const { terminalRef, focus } = useTerminal({ sessionId, cwd, onExit })

  return (
    <div>
      <div
        data-testid="terminal-container"
        ref={(node) => {
          ;(terminalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (node) {
            Object.defineProperty(node, 'getBoundingClientRect', {
              configurable: true,
              value: () => makeRect(900, 560),
            })
          }
        }}
      />
      <button data-testid="focus-terminal" onClick={focus}>Focus</button>
    </div>
  )
}

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    terminalInstances.length = 0
    fitAddonInstances.length = 0
    subscribedPtyDataHandler = null
    subscribedPtyExitHandler = null
    unsubscribePtyData = vi.fn()
    unsubscribePtyExit = vi.fn()

    window.electronAPI.pty.spawn = vi.fn().mockResolvedValue(undefined)
    window.electronAPI.pty.input = vi.fn()
    window.electronAPI.pty.resize = vi.fn()
    window.electronAPI.pty.kill = vi.fn()

    window.electronAPI.terminal.showContextMenu = vi.fn()
    window.electronAPI.terminal.onContextMenuAction = vi.fn(() => vi.fn())

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('from-clipboard'),
      },
    })
  })

  it('initializes terminal, spawns PTY, and performs initial/follow-up resize', async () => {
    render(<Harness sessionId="session-1" cwd="/repo" />)

    await waitFor(() => {
      expect(window.electronAPI.pty.spawn).toHaveBeenCalledWith({
        sessionId: 'session-1',
        cwd: '/repo',
      })
    })

    await waitFor(() => {
      expect((window.electronAPI.pty.resize as Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    const terminal = terminalInstances[0]
    expect(terminal.open).toHaveBeenCalledWith(screen.getByTestId('terminal-container'))
    expect(fitAddonInstances[0].fit).toHaveBeenCalled()

    const resizeCalls = (window.electronAPI.pty.resize as Mock).mock.calls.map(([payload]) => payload)
    expect(resizeCalls.length).toBeGreaterThanOrEqual(2)
    resizeCalls.forEach((payload) => {
      expect(payload.sessionId).toBe('session-1')
      expect(payload.cols).toBeGreaterThan(0)
      expect(payload.rows).toBeGreaterThan(0)
    })
  })

  it('routes right-click and context menu actions (copy, paste, selectAll, clear)', async () => {
    let contextActionHandler: ((action: 'copy' | 'paste' | 'selectAll' | 'clear') => void) | null = null
    const unsubscribeContextMenu = vi.fn()
    window.electronAPI.terminal.onContextMenuAction = vi.fn((handler) => {
      contextActionHandler = handler
      return unsubscribeContextMenu
    })

    render(<Harness sessionId="session-2" cwd="/repo" />)

    await waitFor(() => {
      expect(terminalInstances).toHaveLength(1)
    })

    const terminal = terminalInstances[0]
    terminal.hasSelection.mockReturnValue(true)
    terminal.getSelection.mockReturnValue('selected text')

    fireEvent.contextMenu(screen.getByTestId('terminal-container'))
    expect(window.electronAPI.terminal.showContextMenu).toHaveBeenCalledWith(true, 'selected text')

    await act(async () => {
      contextActionHandler?.('paste')
      contextActionHandler?.('selectAll')
      contextActionHandler?.('clear')
      await Promise.resolve()
    })

    expect(navigator.clipboard.readText).toHaveBeenCalled()
    expect(terminal.paste).toHaveBeenCalledWith('from-clipboard')
    expect(terminal.selectAll).toHaveBeenCalled()
    expect(terminal.clear).toHaveBeenCalled()
    expect(unsubscribeContextMenu).not.toHaveBeenCalled()
  })

  it('writes PTY data to terminal and calls onExit when PTY exits', async () => {
    const onExit = vi.fn()
    render(<Harness sessionId="session-3" cwd="/repo" onExit={onExit} />)

    await waitFor(() => {
      expect(subscribePtyDataMock).toHaveBeenCalledWith('session-3', expect.any(Function))
      expect(subscribePtyExitMock).toHaveBeenCalledWith('session-3', expect.any(Function))
    })

    const terminal = terminalInstances[0]

    act(() => {
      subscribedPtyDataHandler?.('hello from pty')
      subscribedPtyExitHandler?.(0)
    })

    expect(terminal.write).toHaveBeenCalledWith('hello from pty')
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('forwards xterm input to PTY and exposes focus()', async () => {
    render(<Harness sessionId="session-4" cwd="/repo" />)

    await waitFor(() => {
      expect(terminalInstances).toHaveLength(1)
    })

    const terminal = terminalInstances[0]
    const onDataHandler = terminal.onData.mock.calls[0][0]

    act(() => {
      onDataHandler('typed text')
    })
    expect(window.electronAPI.pty.input).toHaveBeenCalledWith('session-4', 'typed text')

    fireEvent.click(screen.getByTestId('focus-terminal'))
    expect(terminal.focus).toHaveBeenCalled()
  })

  it('cleans up subscriptions, PTY process, and terminal instance on unmount', async () => {
    const unsubscribeContextMenu = vi.fn()
    window.electronAPI.terminal.onContextMenuAction = vi.fn(() => unsubscribeContextMenu)

    const { unmount } = render(<Harness sessionId="session-5" cwd="/repo" />)

    await waitFor(() => {
      expect(window.electronAPI.pty.spawn).toHaveBeenCalled()
    })

    const terminal = terminalInstances[0]
    unmount()

    expect(unsubscribePtyData).toHaveBeenCalledTimes(1)
    expect(unsubscribePtyExit).toHaveBeenCalledTimes(1)
    expect(unsubscribeContextMenu).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.pty.kill).toHaveBeenCalledWith('session-5')
    expect(terminal.dispose).toHaveBeenCalledTimes(1)
  })
})
