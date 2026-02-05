import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { SessionProvider, useSessionContext } from '@renderer/context/SessionContext'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
)

describe('useSessions (SessionContext)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty sessions and null activeSessionId', () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    expect(result.current.sessions).toEqual([])
    expect(result.current.activeSessionId).toBeNull()
  })

  it('creates session with unique ID', async () => {
    window.electronAPI.fs.selectDirectory = vi.fn().mockResolvedValue('/test/path')

    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession()
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].id).toMatch(/^session-\d+-[a-z0-9]+$/)
    expect(result.current.sessions[0].cwd).toBe('/test/path')
    expect(result.current.sessions[0].name).toBe('path')
  })

  it('creates session with provided cwd', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/custom/directory')
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].cwd).toBe('/custom/directory')
    expect(result.current.sessions[0].name).toBe('directory')
  })

  it('sets active session on create', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
    })

    const firstSessionId = result.current.sessions[0].id
    expect(result.current.activeSessionId).toBe(firstSessionId)

    await act(async () => {
      await result.current.createSession('/test/two')
    })

    const secondSessionId = result.current.sessions[1].id
    expect(result.current.activeSessionId).toBe(secondSessionId)
  })

  it('removes session by ID', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
    })

    expect(result.current.sessions).toHaveLength(2)

    const sessionToRemove = result.current.sessions[0].id

    act(() => {
      result.current.closeSession(sessionToRemove)
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions.find((s) => s.id === sessionToRemove)).toBeUndefined()
  })

  it('tracks active session correctly', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
      await result.current.createSession('/test/three')
    })

    const [first, second, third] = result.current.sessions

    act(() => {
      result.current.setActiveSession(first.id)
    })

    expect(result.current.activeSessionId).toBe(first.id)

    act(() => {
      result.current.setActiveSession(third.id)
    })

    expect(result.current.activeSessionId).toBe(third.id)
  })

  it('handles closing active session - switches to adjacent', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
      await result.current.createSession('/test/three')
    })

    const [first, second, third] = result.current.sessions

    // Make second tab active
    act(() => {
      result.current.setActiveSession(second.id)
    })

    // Close the second tab
    act(() => {
      result.current.closeSession(second.id)
    })

    // Should switch to what was third (now at index 1)
    expect(result.current.activeSessionId).toBe(third.id)
  })

  it('handles closing last session - sets activeSessionId to null', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/only')
    })

    const onlySession = result.current.sessions[0]

    act(() => {
      result.current.closeSession(onlySession.id)
    })

    expect(result.current.sessions).toHaveLength(0)
    expect(result.current.activeSessionId).toBeNull()
  })

  it('handles closing non-active session - keeps active session', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
    })

    const [first, second] = result.current.sessions

    // second is active (last created)
    expect(result.current.activeSessionId).toBe(second.id)

    // Close the first (non-active) tab
    act(() => {
      result.current.closeSession(first.id)
    })

    // Active should still be second
    expect(result.current.activeSessionId).toBe(second.id)
  })

  it('generates unique IDs for each session', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
      await result.current.createSession('/test/three')
    })

    const ids = result.current.sessions.map((s) => s.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(3)
  })

  it('uses home directory when directory selection is cancelled', async () => {
    window.electronAPI.fs.selectDirectory = vi.fn().mockResolvedValue(null)

    const { result } = renderHook(() => useSessionContext(), { wrapper })

    await act(async () => {
      await result.current.createSession()
    })

    // Should use the fallback (homedir from utils)
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].cwd).toBeTruthy()
  })

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useSessionContext())
    }).toThrow('useSessionContext must be used within a SessionProvider')

    consoleSpy.mockRestore()
  })
})
