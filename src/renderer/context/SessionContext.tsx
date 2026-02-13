import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react'
import { Session, AutomationBootstrapRequest } from '@shared/types'

interface SessionContextType {
  sessions: Session[]
  activeSessionId: string | null
  sessionCwds: Map<string, string>  // Track current CWD per session
  sessionGitRoots: Map<string, string | null>  // Track git root per session
  createSession: (cwd?: string, bootstrapCommands?: string[]) => Promise<string>
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
  reorderSession: (fromIndex: number, toIndex: number) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getDirectoryName(cwd: string): string {
  if (typeof cwd !== 'string') {
    return 'Terminal'
  }
  const parts = cwd.split(/[/\\]/)
  return parts[parts.length - 1] || cwd
}

function getSessionName(branch: string | null, cwd: string): string {
  // If no branch or branch is main/master, use directory name
  if (!branch || branch === 'main' || branch === 'master') {
    return getDirectoryName(cwd)
  }
  return branch
}

async function getDefaultDirectory(): Promise<string> {
  try {
    return await window.electronAPI.fs.getHomeDir()
  } catch {
    // Fallback
    return '/home'
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionCwds, setSessionCwds] = useState<Map<string, string>>(new Map())
  const [sessionGitRoots, setSessionGitRoots] = useState<Map<string, string | null>>(new Map())
  const initialSessionCreated = useRef(false)
  const activeSessionIdRef = useRef<string | null>(null)
  const sessionsRef = useRef<Session[]>([])
  activeSessionIdRef.current = activeSessionId
  sessionsRef.current = sessions

  const createSession = useCallback(async (cwd?: string, bootstrapCommands?: string[]) => {
    // Use provided cwd or default to home directory
    let sessionCwd = cwd || await getDefaultDirectory()

    // Ensure cwd is a valid string
    if (typeof sessionCwd !== 'string' || sessionCwd.length === 0) {
      sessionCwd = await getDefaultDirectory()
    }

    // Try to get the current branch
    let branch: string | null = null
    try {
      branch = await window.electronAPI.git.getCurrentBranch(sessionCwd)
    } catch {
      // Not a git repo or error, that's fine
    }

    const newSession: Session = {
      id: generateId(),
      cwd: sessionCwd,
      name: getSessionName(branch, sessionCwd),
      bootstrapCommands,
    }

    setSessions((prev) => [...prev, newSession])
    setActiveSessionId(newSession.id)
    return newSession.id
  }, [])

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const newSessions = prev.filter((s) => s.id !== id)

      // If closing active session, switch to another
      if (activeSessionIdRef.current === id && newSessions.length > 0) {
        const closedIndex = prev.findIndex((s) => s.id === id)
        const newActiveIndex = Math.min(closedIndex, newSessions.length - 1)
        setActiveSessionId(newSessions[newActiveIndex].id)
      } else if (newSessions.length === 0) {
        // Quit the app when the last tab is closed
        window.electronAPI.window.quit()
      }

      return newSessions
    })
  }, [])

  const setActiveSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const reorderSession = useCallback((fromIndex: number, toIndex: number) => {
    setSessions((prev) => {
      if (fromIndex === toIndex) return prev
      if (fromIndex < 0 || fromIndex >= prev.length) return prev
      if (toIndex < 0 || toIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  // Create initial session on launch
  useEffect(() => {
    if (!initialSessionCreated.current) {
      initialSessionCreated.current = true
      void createSession()
    }
  }, [createSession])

  useEffect(() => {
    window.electronAPI.automation.notifyRendererReady()
  }, [])

  // Poll for CWD/branch changes and update session names
  useEffect(() => {
    if (sessions.length === 0) return

    let isUpdating = false

    const updateSessions = async () => {
      // Skip if hidden or already updating
      if (document.hidden || isUpdating) return
      isUpdating = true

      try {
        const nameUpdates: { id: string; name: string }[] = []
        const cwdUpdates = new Map<string, string>()
        const gitRootUpdates = new Map<string, string | null>()

        const currentSessions = sessionsRef.current
        const currentSessionIds = new Set(currentSessions.map((s) => s.id))

        // Batch CWD lookups: single lsof call on macOS instead of N
        const sessionIds = currentSessions.map((s) => s.id)
        let cwdResults: Record<string, string | null> = {}
        try {
          cwdResults = await window.electronAPI.pty.getCwds(sessionIds)
        } catch {
          // Fallback: getCwds not available (shouldn't happen, but safe)
        }

        // Deduplicate branch lookups: one getCurrentBranch call per unique git root
        const branchPromises = new Map<string, Promise<string | null>>()

        // Poll all sessions concurrently instead of sequentially
        await Promise.all(currentSessions.map(async (session) => {
          try {
            const currentCwd = cwdResults[session.id] ?? null

            // If getCwd failed (e.g. lsof timeout on macOS), skip this session
            // entirely — preserve whatever CWD/gitRoot we had before rather than
            // falling back to the stale initial session.cwd (typically home dir).
            if (!currentCwd) return

            // Track CWD
            cwdUpdates.set(session.id, currentCwd)

            // Resolve git root first — skip branch lookup for non-git dirs
            const root = await window.electronAPI.git.findGitRoot(currentCwd)
            gitRootUpdates.set(session.id, root)

            let branch: string | null = null
            if (root) {
              // Reuse branch promise for sessions sharing the same git root
              if (!branchPromises.has(root)) {
                branchPromises.set(root, window.electronAPI.git.getCurrentBranch(root))
              }
              branch = await branchPromises.get(root)!
            }
            const newName = getSessionName(branch, currentCwd)

            if (newName !== session.name) {
              nameUpdates.push({ id: session.id, name: newName })
            }
          } catch {
            // Ignore errors — session keeps its previous CWD/gitRoot
          }
        }))

        // Merge updates into existing maps instead of replacing them wholesale.
        // Sessions where getCwd failed (or threw) are simply not in the update
        // maps, so their previous values are preserved.
        setSessionCwds((prev) => {
          let changed = false
          const next = new Map(prev)
          for (const [key, value] of cwdUpdates) {
            if (next.get(key) !== value) {
              next.set(key, value)
              changed = true
            }
          }
          // Clean up entries for closed sessions
          for (const key of prev.keys()) {
            if (!currentSessionIds.has(key)) {
              next.delete(key)
              changed = true
            }
          }
          return changed ? next : prev
        })
        setSessionGitRoots((prev) => {
          let changed = false
          const next = new Map(prev)
          for (const [key, value] of gitRootUpdates) {
            if (next.get(key) !== value) {
              next.set(key, value)
              changed = true
            }
          }
          for (const key of prev.keys()) {
            if (!currentSessionIds.has(key)) {
              next.delete(key)
              changed = true
            }
          }
          return changed ? next : prev
        })

        // Update names if changed
        if (nameUpdates.length > 0) {
          const nameById = new Map(nameUpdates.map((update) => [update.id, update.name]))
          setSessions((prev) =>
            prev.map((s) => {
              const nextName = nameById.get(s.id)
              return nextName ? { ...s, name: nextName } : s
            })
          )
        }
      } finally {
        isUpdating = false
      }
    }

    // Poll every 5 seconds (reduced from 2s)
    const interval = setInterval(updateSessions, 5000)
    // Also run immediately
    updateSessions()

    // Refresh when tab becomes visible
    const handleVisibility = () => {
      if (!document.hidden) updateSessions()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [sessions.length])

  // Subscribe to instant CWD updates via OSC 7 shell integration
  useEffect(() => {
    const unsubscribe = window.electronAPI.pty.onCwdChanged(async (sessionId, cwd) => {
      // Update CWD immediately
      setSessionCwds((prev) => {
        if (prev.get(sessionId) === cwd) return prev
        const next = new Map(prev)
        next.set(sessionId, cwd)
        return next
      })

      // Resolve git root and update session name
      try {
        const root = await window.electronAPI.git.findGitRoot(cwd)
        setSessionGitRoots((prev) => {
          if (prev.get(sessionId) === root) return prev
          const next = new Map(prev)
          next.set(sessionId, root)
          return next
        })

        let branch: string | null = null
        if (root) {
          branch = await window.electronAPI.git.getCurrentBranch(root)
        }
        const newName = getSessionName(branch, cwd)

        setSessions((prev) => {
          const index = prev.findIndex((s) => s.id === sessionId)
          if (index === -1 || prev[index].name === newName) {
            return prev
          }
          const next = [...prev]
          next[index] = { ...next[index], name: newName }
          return next
        })
      } catch {
        // Ignore errors from git lookups
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.electronAPI.automation.onBootstrapRequest(async (request: AutomationBootstrapRequest) => {
      const { requestId, cwd, commands } = request

      try {
        const sessionId = await createSession(cwd, commands)
        window.electronAPI.automation.sendBootstrapResult({
          requestId,
          ok: true,
          sessionId,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create session'
        window.electronAPI.automation.sendBootstrapResult({
          requestId,
          ok: false,
          error: message,
        })
      }
    })

    return unsubscribe
  }, [createSession])

  const contextValue = useMemo(() => ({
    sessions,
    activeSessionId,
    sessionCwds,
    sessionGitRoots,
    createSession,
    closeSession,
    setActiveSession,
    reorderSession,
  }), [sessions, activeSessionId, sessionCwds, sessionGitRoots, createSession, closeSession, setActiveSession, reorderSession])

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider')
  }
  return context
}
