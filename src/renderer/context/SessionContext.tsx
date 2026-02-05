import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { Session } from '@shared/types'

interface SessionContextType {
  sessions: Session[]
  activeSessionId: string | null
  createSession: (cwd?: string) => Promise<void>
  closeSession: (id: string) => void
  setActiveSession: (id: string) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getSessionName(cwd: string): string {
  if (typeof cwd !== 'string') {
    return 'Terminal'
  }
  const parts = cwd.split(/[/\\]/)
  return parts[parts.length - 1] || cwd
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
  const initialSessionCreated = useRef(false)

  const createSession = useCallback(async (cwd?: string) => {
    // Use provided cwd or default to home directory
    let sessionCwd = cwd || await getDefaultDirectory()

    // Ensure cwd is a valid string
    if (typeof sessionCwd !== 'string' || sessionCwd.length === 0) {
      sessionCwd = await getDefaultDirectory()
    }

    const newSession: Session = {
      id: generateId(),
      cwd: sessionCwd,
      name: getSessionName(sessionCwd),
    }

    setSessions((prev) => [...prev, newSession])
    setActiveSessionId(newSession.id)
  }, [])

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const newSessions = prev.filter((s) => s.id !== id)

      // If closing active session, switch to another
      if (activeSessionId === id && newSessions.length > 0) {
        const closedIndex = prev.findIndex((s) => s.id === id)
        const newActiveIndex = Math.min(closedIndex, newSessions.length - 1)
        setActiveSessionId(newSessions[newActiveIndex].id)
      } else if (newSessions.length === 0) {
        setActiveSessionId(null)
      }

      return newSessions
    })
  }, [activeSessionId])

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

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        closeSession,
        setActiveSession,
      }}
    >
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
