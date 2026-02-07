import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInputWaiting } from '@renderer/hooks/useInputWaiting'

const handlers = new Map<string, (data: string) => void>()
const mockSubscribePtyData = vi.fn((sessionId: string, handler: (data: string) => void) => {
  handlers.set(sessionId, handler)
  return () => {
    handlers.delete(sessionId)
  }
})

vi.mock('@renderer/lib/eventDispatchers', () => ({
  subscribePtyData: (sessionId: string, handler: (data: string) => void) =>
    mockSubscribePtyData(sessionId, handler),
}))

describe('useInputWaiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    window.electronAPI.pty.getForegroundProcess.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls only background sessions and marks idle claude/codex sessions as waiting', async () => {
    window.electronAPI.pty.getForegroundProcess.mockImplementation(async (sessionId: string) => (
      sessionId === 's2' ? 'claude' : null
    ))

    const sessions = [
      { id: 's1', cwd: '/repo/one', name: 'one' },
      { id: 's2', cwd: '/repo/two', name: 'two' },
    ]

    const { result } = renderHook(() => useInputWaiting(sessions, 's1'))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.has('s2')).toBe(true)

    expect(window.electronAPI.pty.getForegroundProcess).toHaveBeenCalledWith('s2')
    expect(window.electronAPI.pty.getForegroundProcess).not.toHaveBeenCalledWith('s1')
  })

  it('does not mark waiting when there was recent output activity', async () => {
    window.electronAPI.pty.getForegroundProcess.mockResolvedValue('codex')
    const sessions = [
      { id: 's1', cwd: '/repo/one', name: 'one' },
      { id: 's2', cwd: '/repo/two', name: 'two' },
    ]

    const { result } = renderHook(() => useInputWaiting(sessions, 's1'))

    await act(async () => {
      vi.advanceTimersByTime(2500)
      handlers.get('s2')?.('new output')
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(result.current.has('s2')).toBe(false)
  })

  it('clears waiting state immediately when that tab becomes active', async () => {
    window.electronAPI.pty.getForegroundProcess.mockResolvedValue('claude')
    const sessions = [
      { id: 's1', cwd: '/repo/one', name: 'one' },
      { id: 's2', cwd: '/repo/two', name: 'two' },
    ]

    const { result, rerender } = renderHook(
      ({ activeSessionId }) => useInputWaiting(sessions, activeSessionId),
      { initialProps: { activeSessionId: 's1' as string | null } }
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.has('s2')).toBe(true)

    await act(async () => {
      rerender({ activeSessionId: 's2' })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.has('s2')).toBe(false)
  })
})
