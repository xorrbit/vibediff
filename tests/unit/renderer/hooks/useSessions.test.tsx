import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { SessionProvider, useSessionContext } from '@renderer/context/SessionContext'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
)

function forceDocumentHidden(value: boolean): () => void {
  const previous = Object.getOwnPropertyDescriptor(document, 'hidden')
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => value,
  })
  return () => {
    if (previous) {
      Object.defineProperty(document, 'hidden', previous)
      return
    }
    delete (document as { hidden?: boolean }).hidden
  }
}

describe('useSessions (SessionContext)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with initial session auto-created', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // SessionProvider auto-creates an initial session on mount
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })
    expect(result.current.activeSessionId).toBe(result.current.sessions[0].id)
  })

  it('creates session with unique ID', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session to be created
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })
    const initialCount = result.current.sessions.length

    await act(async () => {
      await result.current.createSession('/test/path')
    })

    expect(result.current.sessions).toHaveLength(initialCount + 1)
    const newSession = result.current.sessions[result.current.sessions.length - 1]
    expect(newSession.id).toMatch(/^session-\d+-[a-z0-9]+$/)
    expect(newSession.cwd).toBe('/test/path')
    expect(newSession.name).toBe('path')
  })

  it('creates session with provided cwd', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    await act(async () => {
      await result.current.createSession('/custom/directory')
    })

    expect(result.current.sessions).toHaveLength(2)
    const newSession = result.current.sessions[1]
    expect(newSession.cwd).toBe('/custom/directory')
    expect(newSession.name).toBe('directory')
  })

  it('sets active session on create', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    // Initial session should be active
    expect(result.current.activeSessionId).toBe(result.current.sessions[0].id)

    await act(async () => {
      await result.current.createSession('/test/one')
    })

    // Newly created session should be active
    const newSessionId = result.current.sessions[result.current.sessions.length - 1].id
    expect(result.current.activeSessionId).toBe(newSessionId)

    await act(async () => {
      await result.current.createSession('/test/two')
    })

    // Latest session should be active
    const latestSessionId = result.current.sessions[result.current.sessions.length - 1].id
    expect(result.current.activeSessionId).toBe(latestSessionId)
  })

  it('removes session by ID', async () => {
    const restoreDocumentHidden = forceDocumentHidden(true)
    try {
      const { result } = renderHook(() => useSessionContext(), { wrapper })

      // Wait for initial session
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/one')
        await result.current.createSession('/test/two')
      })

      expect(result.current.sessions).toHaveLength(3) // initial + 2 new

      const sessionToRemove = result.current.sessions[1].id

      act(() => {
        result.current.closeSession(sessionToRemove)
      })

      expect(result.current.sessions).toHaveLength(2)
      expect(result.current.sessions.find((s) => s.id === sessionToRemove)).toBeUndefined()
    } finally {
      restoreDocumentHidden()
    }
  })

  it('tracks active session correctly', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
      await result.current.createSession('/test/three')
    })

    const [initial, first, second, third] = result.current.sessions

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
    const restoreDocumentHidden = forceDocumentHidden(true)
    try {
      const { result } = renderHook(() => useSessionContext(), { wrapper })

      // Wait for initial session
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/one')
        await result.current.createSession('/test/two')
        await result.current.createSession('/test/three')
      })

      const [initial, first, second, third] = result.current.sessions

      // Make second tab active
      act(() => {
        result.current.setActiveSession(second.id)
      })

      // Close the second tab
      act(() => {
        result.current.closeSession(second.id)
      })

      // Should switch to what was third (now at same index)
      expect(result.current.activeSessionId).toBe(third.id)
    } finally {
      restoreDocumentHidden()
    }
  })

  it('handles closing last session - quits the app', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    // Close the initial session (the only one)
    const onlySession = result.current.sessions[0]

    act(() => {
      result.current.closeSession(onlySession.id)
    })

    expect(result.current.sessions).toHaveLength(0)
    expect(window.electronAPI.window.quit).toHaveBeenCalled()
  })

  it('handles closing non-active session - keeps active session', async () => {
    const restoreDocumentHidden = forceDocumentHidden(true)
    try {
      const { result } = renderHook(() => useSessionContext(), { wrapper })

      // Wait for initial session
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/one')
        await result.current.createSession('/test/two')
      })

      const [initial, first, second] = result.current.sessions

      // second is active (last created)
      expect(result.current.activeSessionId).toBe(second.id)

      // Close the first (non-active) tab
      act(() => {
        result.current.closeSession(first.id)
      })

      // Active should still be second
      expect(result.current.activeSessionId).toBe(second.id)
    } finally {
      restoreDocumentHidden()
    }
  })

  it('generates unique IDs for each session', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    await act(async () => {
      await result.current.createSession('/test/one')
      await result.current.createSession('/test/two')
      await result.current.createSession('/test/three')
    })

    const ids = result.current.sessions.map((s) => s.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(4) // initial + 3 new
  })

  it('uses home directory when no cwd provided', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper })

    // Wait for initial session (which uses home directory)
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    // Initial session should use the fallback (homedir from mocked getHomeDir)
    expect(result.current.sessions[0].cwd).toBe('/home/test')
  })

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useSessionContext())
    }).toThrow('useSessionContext must be used within a SessionProvider')

    consoleSpy.mockRestore()
  })

  describe('session naming', () => {
    it('uses branch name when not main/master', async () => {
      // Mock git to return a feature branch
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue('feature/awesome')
      vi.mocked(window.electronAPI.git.findGitRoot).mockResolvedValue('/test/project')

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      }, { timeout: 3000 })

      await act(async () => {
        await result.current.createSession('/test/project')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('feature/awesome')
    })

    it('uses directory name when branch is main', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue('main')

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/myproject')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('myproject')
    })

    it('uses directory name when branch is master', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue('master')

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/legacy-project')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('legacy-project')
    })

    it('uses directory name when not a git repo', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue(null)

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/home/user/documents')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('documents')
    })

    it('uses directory name when git throws error', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockRejectedValue(new Error('Not a git repo'))

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('/test/folder')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('folder')
    })

    it('handles Windows-style paths', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue(null)

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      await act(async () => {
        await result.current.createSession('C:\\Users\\Test\\Projects\\MyApp')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      expect(newSession.name).toBe('MyApp')
    })

    it('handles paths ending with separator', async () => {
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue(null)

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      // When path ends with /, the last part is empty, so it returns the path itself
      await act(async () => {
        await result.current.createSession('/test/folder/')
      })

      const newSession = result.current.sessions[result.current.sessions.length - 1]
      // The getDirectoryName returns the last non-empty part or the full path
      expect(newSession.name).toBeTruthy()
    })
  })

  describe('reorderSession', () => {
    it('moves a session forward in the list', async () => {
      const restoreDocumentHidden = forceDocumentHidden(true)
      try {
        const { result } = renderHook(() => useSessionContext(), { wrapper })

        await waitFor(() => {
          expect(result.current.sessions).toHaveLength(1)
        })

        await act(async () => {
          await result.current.createSession('/test/one')
          await result.current.createSession('/test/two')
        })

        expect(result.current.sessions).toHaveLength(3)
        const originalOrder = result.current.sessions.map((s) => s.cwd)

        // Move first session (index 0) to index 2
        act(() => {
          result.current.reorderSession(0, 2)
        })

        const newOrder = result.current.sessions.map((s) => s.cwd)
        expect(newOrder[0]).toBe(originalOrder[1])
        expect(newOrder[1]).toBe(originalOrder[2])
        expect(newOrder[2]).toBe(originalOrder[0])
      } finally {
        restoreDocumentHidden()
      }
    })

    it('moves a session backward in the list', async () => {
      const restoreDocumentHidden = forceDocumentHidden(true)
      try {
        const { result } = renderHook(() => useSessionContext(), { wrapper })

        await waitFor(() => {
          expect(result.current.sessions).toHaveLength(1)
        })

        await act(async () => {
          await result.current.createSession('/test/one')
          await result.current.createSession('/test/two')
        })

        const originalOrder = result.current.sessions.map((s) => s.cwd)

        // Move last session (index 2) to index 0
        act(() => {
          result.current.reorderSession(2, 0)
        })

        const newOrder = result.current.sessions.map((s) => s.cwd)
        expect(newOrder[0]).toBe(originalOrder[2])
        expect(newOrder[1]).toBe(originalOrder[0])
        expect(newOrder[2]).toBe(originalOrder[1])
      } finally {
        restoreDocumentHidden()
      }
    })

    it('does nothing when fromIndex equals toIndex', async () => {
      const restoreDocumentHidden = forceDocumentHidden(true)
      try {
        const { result } = renderHook(() => useSessionContext(), { wrapper })

        await waitFor(() => {
          expect(result.current.sessions).toHaveLength(1)
        })

        await act(async () => {
          await result.current.createSession('/test/one')
        })

        const sessionsBefore = result.current.sessions

        act(() => {
          result.current.reorderSession(0, 0)
        })

        // Should return same reference (no-op)
        expect(result.current.sessions).toBe(sessionsBefore)
      } finally {
        restoreDocumentHidden()
      }
    })

    it('does nothing for out-of-bounds indices', async () => {
      const restoreDocumentHidden = forceDocumentHidden(true)
      try {
        const { result } = renderHook(() => useSessionContext(), { wrapper })

        await waitFor(() => {
          expect(result.current.sessions).toHaveLength(1)
        })

        const sessionsBefore = result.current.sessions

        act(() => {
          result.current.reorderSession(-1, 0)
        })
        expect(result.current.sessions).toBe(sessionsBefore)

        act(() => {
          result.current.reorderSession(0, 5)
        })
        expect(result.current.sessions).toBe(sessionsBefore)
      } finally {
        restoreDocumentHidden()
      }
    })

    it('preserves active session after reorder', async () => {
      const restoreDocumentHidden = forceDocumentHidden(true)
      try {
        const { result } = renderHook(() => useSessionContext(), { wrapper })

        await waitFor(() => {
          expect(result.current.sessions).toHaveLength(1)
        })

        await act(async () => {
          await result.current.createSession('/test/one')
          await result.current.createSession('/test/two')
        })

        // Last created session is active
        const activeId = result.current.activeSessionId

        act(() => {
          result.current.reorderSession(0, 2)
        })

        // Active session ID should not change
        expect(result.current.activeSessionId).toBe(activeId)
      } finally {
        restoreDocumentHidden()
      }
    })
  })

  describe('CWD tracking', () => {
    it('updates sessionCwds when polling', async () => {
      vi.useFakeTimers()
      vi.mocked(window.electronAPI.pty.getCwds).mockImplementation(async (ids) => {
        const result: Record<string, string | null> = {}
        for (const id of ids) result[id] = '/new/working/dir'
        return result
      })
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue(null)

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      // Wait for initial session with fake timers
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.sessions).toHaveLength(1)

      // Trigger the polling interval (5 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      const sessionId = result.current.sessions[0].id
      expect(result.current.sessionCwds.get(sessionId)).toBe('/new/working/dir')

      vi.useRealTimers()
    })

    it('updates session name when branch changes', async () => {
      vi.useFakeTimers()
      vi.mocked(window.electronAPI.pty.getCwds).mockImplementation(async (ids) => {
        const result: Record<string, string | null> = {}
        for (const id of ids) result[id] = '/test/project'
        return result
      })
      vi.mocked(window.electronAPI.git.findGitRoot).mockResolvedValue('/test/project')

      // Initially return main
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue('main')

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      // Wait for initial session
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.sessions).toHaveLength(1)
      // Session should use directory name initially (from cwd mock: /test/project)
      expect(result.current.sessions[0].name).toBe('project')

      // Now switch to a feature branch
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockResolvedValue('feature/new-thing')

      // Trigger poll (5 seconds)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(result.current.sessions[0].name).toBe('feature/new-thing')

      vi.useRealTimers()
    })

    it('falls back to /home when getHomeDir rejects', async () => {
      vi.mocked(window.electronAPI.fs.getHomeDir).mockRejectedValue(new Error('permission denied'))

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      expect(result.current.sessions[0].cwd).toBe('/home')
    })

    it('skips polling updates while document is hidden', async () => {
      vi.useFakeTimers()
      vi.mocked(window.electronAPI.pty.getCwds).mockImplementation(async (ids) => {
        const result: Record<string, string | null> = {}
        for (const id of ids) result[id] = '/hidden/dir'
        return result
      })

      let hidden = true
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => hidden,
      })

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(result.current.sessions).toHaveLength(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000)
      })

      expect(window.electronAPI.pty.getCwds).not.toHaveBeenCalled()

      hidden = false
      vi.useRealTimers()
    })

    it('refreshes session state on visibilitychange when document becomes visible', async () => {
      vi.useFakeTimers()
      vi.mocked(window.electronAPI.pty.getCwds).mockImplementation(async (ids) => {
        const result: Record<string, string | null> = {}
        for (const id of ids) result[id] = '/visible/dir'
        return result
      })

      let hidden = true
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => hidden,
      })

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(result.current.sessions).toHaveLength(1)
      expect(window.electronAPI.pty.getCwds).not.toHaveBeenCalled()

      hidden = false
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await Promise.resolve()
      })

      expect(window.electronAPI.pty.getCwds).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('updates sessionCwds, sessionGitRoots, and session name on onCwdChanged', async () => {
      let cwdChangedHandler: ((sessionId: string, cwd: string) => void | Promise<void>) | null = null
      window.electronAPI.pty.onCwdChanged = vi.fn((handler) => {
        cwdChangedHandler = handler
        return () => {}
      })

      vi.mocked(window.electronAPI.git.findGitRoot).mockImplementation(async (cwd) =>
        cwd.startsWith('/repo') ? '/repo' : null
      )
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockImplementation(async (cwd) =>
        cwd === '/repo' ? 'feature/new-ui' : null
      )

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      const sessionId = result.current.sessions[0].id

      await act(async () => {
        await cwdChangedHandler?.(sessionId, '/repo/worktree')
      })

      expect(result.current.sessionCwds.get(sessionId)).toBe('/repo/worktree')
      expect(result.current.sessionGitRoots.get(sessionId)).toBe('/repo')
      expect(result.current.sessions.find((s) => s.id === sessionId)?.name).toBe('feature/new-ui')
    })

    it('does not churn map/session state when onCwdChanged receives unchanged values', async () => {
      let cwdChangedHandler: ((sessionId: string, cwd: string) => void | Promise<void>) | null = null
      window.electronAPI.pty.onCwdChanged = vi.fn((handler) => {
        cwdChangedHandler = handler
        return () => {}
      })

      vi.mocked(window.electronAPI.git.findGitRoot).mockResolvedValue('/repo')
      vi.mocked(window.electronAPI.git.getCurrentBranch).mockImplementation(async (cwd) =>
        cwd === '/repo' ? 'feature/new-ui' : null
      )

      const { result } = renderHook(() => useSessionContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      const sessionId = result.current.sessions[0].id

      await act(async () => {
        await cwdChangedHandler?.(sessionId, '/repo/worktree')
      })

      const sessionsRef = result.current.sessions
      const cwdMapRef = result.current.sessionCwds
      const gitRootMapRef = result.current.sessionGitRoots

      await act(async () => {
        await cwdChangedHandler?.(sessionId, '/repo/worktree')
      })

      expect(result.current.sessions).toBe(sessionsRef)
      expect(result.current.sessionCwds).toBe(cwdMapRef)
      expect(result.current.sessionGitRoots).toBe(gitRootMapRef)
    })
  })
})
