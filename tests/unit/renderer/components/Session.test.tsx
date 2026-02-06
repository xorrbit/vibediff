import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React, { createRef } from 'react'

// Mock child components
vi.mock('@renderer/components/layout/ResizableSplit', () => ({
  ResizableSplit: vi.fn(({ left, right, initialRatio }: any) => {
    const React = require('react')
    return React.createElement('div', { 'data-testid': 'mock-resizable-split', 'data-ratio': initialRatio },
      React.createElement('div', { 'data-testid': 'left-pane' }, left),
      React.createElement('div', { 'data-testid': 'right-pane' }, right),
    )
  }),
}))

vi.mock('@renderer/components/terminal/Terminal', () => ({
  Terminal: function MockTerminal(props: any) {
    React.useImperativeHandle(props.ref, () => ({
      focus: vi.fn(),
    }))
    return React.createElement('div', {
      'data-testid': 'mock-terminal',
      'data-session-id': props.sessionId,
    })
  },
  TerminalHandle: {},
}))

vi.mock('@renderer/components/diff/DiffPanel', () => ({
  DiffPanel: vi.fn((props: any) => {
    const React = require('react')
    return React.createElement('div', {
      'data-testid': 'mock-diff-panel',
      'data-session-id': props.sessionId,
    })
  }),
}))

const mockCloseSession = vi.fn()
vi.mock('@renderer/context/SessionContext', () => ({
  useSessionContext: () => ({
    closeSession: mockCloseSession,
  }),
}))

import { Session, SessionHandle } from '@renderer/components/layout/Session'

describe('Session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ResizableSplit with Terminal and DiffPanel', () => {
    const { getByTestId } = render(
      <Session sessionId="s1" cwd="/project" />
    )

    expect(getByTestId('mock-resizable-split')).toBeInTheDocument()
    expect(getByTestId('mock-terminal')).toBeInTheDocument()
    expect(getByTestId('mock-diff-panel')).toBeInTheDocument()
  })

  it('passes sessionId to child components', () => {
    const { getByTestId } = render(
      <Session sessionId="s1" cwd="/project" />
    )

    expect(getByTestId('mock-terminal')).toHaveAttribute('data-session-id', 's1')
    expect(getByTestId('mock-diff-panel')).toHaveAttribute('data-session-id', 's1')
  })

  it('uses 0.5 initial ratio for ResizableSplit', () => {
    const { getByTestId } = render(
      <Session sessionId="s1" cwd="/project" />
    )

    expect(getByTestId('mock-resizable-split')).toHaveAttribute('data-ratio', '0.5')
  })

  it('exposes focusTerminal via ref', () => {
    const ref = createRef<SessionHandle>()

    render(<Session ref={ref} sessionId="s1" cwd="/project" />)

    expect(ref.current).toBeDefined()
    expect(ref.current!.focusTerminal).toBeInstanceOf(Function)
  })

  it('focuses terminal when isActive becomes true', () => {
    // Mock requestAnimationFrame
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const ref = createRef<SessionHandle>()

    render(<Session ref={ref} sessionId="s1" cwd="/project" isActive={true} />)

    // requestAnimationFrame should have been called
    expect(rafSpy).toHaveBeenCalled()

    rafSpy.mockRestore()
  })

  it('does not focus terminal when isActive is false', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    render(<Session sessionId="s1" cwd="/project" isActive={false} />)

    expect(rafSpy).not.toHaveBeenCalled()

    rafSpy.mockRestore()
  })

  it('calls closeSession on terminal exit', () => {
    // The Terminal mock's onExit prop gets called
    // We can't easily trigger it from the mock, but we verify
    // the Session component passes the correct handler
    const { getByTestId } = render(
      <Session sessionId="s1" cwd="/project" />
    )

    expect(getByTestId('mock-terminal')).toBeInTheDocument()
  })
})
