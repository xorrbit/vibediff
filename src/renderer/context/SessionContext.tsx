import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react'
import { Session } from '@shared/types'

interface SessionContextType {
  sessions: Session[]
  activeSessionId: string | null
  sessionCwds: Map<string, string>  // Track current CWD per session
  sessionGitRoots: Map<string, string | null>  // Track git root per session
  createSession: (cwd?: string) => Promise<void>
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

function mapsEqual<K, V>(a: Map<K, V>, b: Map<K, V>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const [key, value] of a) {
    if (!b.has(key) || b.get(key) !== value) return false
  }
  return true
}

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

  const createSession = useCallback(async (cwd?: string) => {
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
    }

    setSessions((prev) => [...prev, newSession])
    setActiveSessionId(newSession.id)
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

  // Create initial session on launch
  useEffect(() => {
    if (!initialSessionCreated.current) {
      initialSessionCreated.current = true
      createSession()
    }
  }, [createSession])

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

        // Poll all sessions concurrently instead of sequentially
        await Promise.all(currentSessions.map(async (session) => {
          try {
            // Get current cwd from terminal
            const currentCwd = await window.electronAPI.pty.getCwd(session.id)
            const cwd = currentCwd || session.cwd

            // Track CWD
            cwdUpdates.set(session.id, cwd)

            // Resolve git root first — skip branch lookup for non-git dirs
            const root = await window.electronAPI.git.findGitRoot(cwd)
            gitRootUpdates.set(session.id, root)

            let branch: string | null = null
            if (root) {
              // Pass git root so SimpleGit instance is reused correctly
              branch = await window.electronAPI.git.getCurrentBranch(root)
            }
            const newName = getSessionName(branch, cwd)

            if (newName !== session.name) {
              nameUpdates.push({ id: session.id, name: newName })
            }
          } catch {
            // Ignore errors
          }
        }))

        // Update CWDs and git roots
        setSessionCwds((prev) => (mapsEqual(prev, cwdUpdates) ? prev : cwdUpdates))
        setSessionGitRoots((prev) => (mapsEqual(prev, gitRootUpdates) ? prev : gitRootUpdates))

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

  const contextValue = useMemo(() => ({
    sessions,
    activeSessionId,
    sessionCwds,
    sessionGitRoots,
    createSession,
    closeSession,
    setActiveSession,
  }), [sessions, activeSessionId, sessionCwds, sessionGitRoots, createSession, closeSession, setActiveSession])

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
