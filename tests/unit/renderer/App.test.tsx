import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockUseSessions = vi.fn()
const mockUseKeyboardShortcuts = vi.fn()
const mockUseInputWaiting = vi.fn()
const focusTerminalBySession = new Map<string, ReturnType<typeof vi.fn>>()

let capturedShortcuts: {
  onNewTab: () => void
  onCloseTab: () => void
  onNextTab: () => string | undefined
  onPrevTab: () => string | undefined
  onGoToTab: (index: number) => void
  onShowHelp?: () => void
  onTabSwitched?: (sessionId: string) => void
} | null = null

vi.mock('@renderer/context/SessionContext', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@renderer/hooks/useSessions', () => ({
  useSessions: () => mockUseSessions(),
}))

vi.mock('@renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (handlers: any) => {
    capturedShortcuts = handlers
    mockUseKeyboardShortcuts(handlers)
  },
}))

vi.mock('@renderer/hooks/useInputWaiting', () => ({
  useInputWaiting: (...args: any[]) => mockUseInputWaiting(...args),
}))

vi.mock('@renderer/components/layout/TabBar', () => ({
  TabBar: ({ sessions, activeSessionId, waitingSessionIds, onTabSelect, onTabClose, onNewTab }: any) => (
    <div
      data-testid="mock-tabbar"
      data-active-id={activeSessionId ?? ''}
      data-waiting={Array.from(waitingSessionIds).join(',')}
    >
      <button data-testid="tabbar-new-tab" onClick={onNewTab}>New tab</button>
      {sessions.map((session: any) => (
        <button
          key={session.id}
          data-testid={`tabbar-select-${session.id}`}
          onClick={() => onTabSelect(session.id)}
        >
          {session.name}
        </button>
      ))}
      {sessions.map((session: any) => (
        <button
          key={`${session.id}-close`}
          data-testid={`tabbar-close-${session.id}`}
          onClick={() => onTabClose(session.id)}
        >
          close-{session.id}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@renderer/components/layout/Session', () => {
  const React = require('react')

  return {
    Session: React.forwardRef((props: any, ref: React.ForwardedRef<{ focusTerminal: () => void }>) => {
      const focusSpy = focusTerminalBySession.get(props.sessionId) ?? vi.fn()
      focusTerminalBySession.set(props.sessionId, focusSpy)

      React.useImperativeHandle(ref, () => ({ focusTerminal: focusSpy }), [focusSpy])

      return React.createElement('div', {
        'data-testid': `session-${props.sessionId}`,
        'data-active': String(!!props.isActive),
        'data-cwd': props.cwd,
        'data-diff-cwd': props.diffCwd,
        'data-git-root-hint': props.gitRootHint ?? '',
      }, props.sessionId)
    }),
  }
})

vi.mock('@renderer/components/common/EmptyState', () => ({
  EmptyState: ({ onCreateSession }: any) => (
    <button data-testid="mock-empty-state" onClick={onCreateSession}>Create</button>
  ),
}))

vi.mock('@renderer/components/common/HelpOverlay', () => ({
  HelpOverlay: ({ isOpen, onClose }: any) => (
    isOpen ? (
      <div data-testid="mock-help-overlay">
        <button data-testid="mock-help-close" onClick={onClose}>Close help</button>
      </div>
    ) : null
  ),
}))

import App from '@renderer/App'

describe('App', () => {
  const createSession = vi.fn()
  const closeSession = vi.fn()
  const setActiveSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedShortcuts = null
    focusTerminalBySession.clear()
    mockUseInputWaiting.mockReturnValue(new Set())

    mockUseSessions.mockReturnValue({
      sessions: [
        { id: 's1', cwd: '/repo/one', name: 'one' },
        { id: 's2', cwd: '/repo/two', name: 'two' },
        { id: 's3', cwd: '/repo/three', name: 'three' },
      ],
      activeSessionId: 's2',
      sessionCwds: new Map([
        ['s1', '/repo/one/current'],
        ['s2', '/repo/two/current'],
      ]),
      sessionGitRoots: new Map([
        ['s1', '/repo/one'],
        ['s2', '/repo/two'],
      ]),
      createSession,
      closeSession,
      setActiveSession,
    })
  })

  it('renders TabBar and marks only the active session as active', () => {
    render(<App />)

    expect(screen.getByTestId('mock-tabbar')).toBeInTheDocument()
    expect(screen.getByTestId('session-s1')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('session-s2')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('session-s3')).toHaveAttribute('data-active', 'false')
  })

  it('passes waiting session ids from useInputWaiting into TabBar', () => {
    mockUseInputWaiting.mockReturnValue(new Set(['s1', 's3']))

    render(<App />)

    expect(screen.getByTestId('mock-tabbar')).toHaveAttribute('data-waiting', 's1,s3')
  })

  it('passes diff cwd/gitRootHint derived from session maps', () => {
    render(<App />)

    expect(screen.getByTestId('session-s2')).toHaveAttribute('data-diff-cwd', '/repo/two/current')
    expect(screen.getByTestId('session-s2')).toHaveAttribute('data-git-root-hint', '/repo/two')
    expect(screen.getByTestId('session-s3')).toHaveAttribute('data-diff-cwd', '/repo/three')
    expect(screen.getByTestId('session-s3')).toHaveAttribute('data-git-root-hint', '')
  })

  it('renders empty state when there are no sessions', () => {
    mockUseSessions.mockReturnValue({
      sessions: [],
      activeSessionId: null,
      sessionCwds: new Map(),
      sessionGitRoots: new Map(),
      createSession,
      closeSession,
      setActiveSession,
    })

    render(<App />)

    fireEvent.click(screen.getByTestId('mock-empty-state'))
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('opens help via shortcut handler and closes it on Escape', () => {
    render(<App />)

    act(() => {
      capturedShortcuts?.onShowHelp?.()
    })
    expect(screen.getByTestId('mock-help-overlay')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('mock-help-overlay')).not.toBeInTheDocument()
  })

  it('routes keyboard shortcuts to session actions', () => {
    render(<App />)

    act(() => {
      capturedShortcuts?.onNewTab()
      capturedShortcuts?.onCloseTab()
      capturedShortcuts?.onGoToTab(0)
    })

    expect(createSession).toHaveBeenCalledTimes(1)
    expect(closeSession).toHaveBeenCalledWith('s2')
    expect(setActiveSession).toHaveBeenCalledWith('s1')
  })

  it('switches tabs and hands focus to the newly active session terminal', () => {
    render(<App />)

    let nextId: string | undefined
    let prevId: string | undefined
    act(() => {
      nextId = capturedShortcuts?.onNextTab()
      if (nextId) capturedShortcuts?.onTabSwitched?.(nextId)
      prevId = capturedShortcuts?.onPrevTab()
      if (prevId) capturedShortcuts?.onTabSwitched?.(prevId)
    })

    expect(nextId).toBe('s3')
    expect(prevId).toBe('s1')
    expect(setActiveSession).toHaveBeenCalledWith('s3')
    expect(setActiveSession).toHaveBeenCalledWith('s1')
    expect(focusTerminalBySession.get('s3')).toHaveBeenCalledTimes(1)
    expect(focusTerminalBySession.get('s1')).toHaveBeenCalledTimes(1)
  })
})
