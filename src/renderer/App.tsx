import { useState, useCallback, useEffect, useRef } from 'react'
import { SessionProvider } from './context/SessionContext'
import { useSessions } from './hooks/useSessions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useInputWaiting } from './hooks/useInputWaiting'
import { TabBar } from './components/layout/TabBar'
import { Session, SessionHandle } from './components/layout/Session'
import { EmptyState } from './components/common/EmptyState'
import { HelpOverlay } from './components/common/HelpOverlay'

function AppContent() {
  const {
    sessions,
    activeSessionId,
    sessionCwds,
    sessionGitRoots,
    createSession,
    closeSession,
    setActiveSession,
  } = useSessions()
  const waitingIds = useInputWaiting(sessions, activeSessionId)

  const [showHelp, setShowHelp] = useState(false)
  const sessionRefs = useRef<Map<string, SessionHandle>>(new Map())
  // Stable ref callbacks — one per session, cached so Session memo isn't broken
  const refCallbacks = useRef<Map<string, (handle: SessionHandle | null) => void>>(new Map())
  const getRefCallback = useCallback((sessionId: string) => {
    let cb = refCallbacks.current.get(sessionId)
    if (!cb) {
      cb = (handle: SessionHandle | null) => {
        if (handle) sessionRefs.current.set(sessionId, handle)
        else {
          sessionRefs.current.delete(sessionId)
          refCallbacks.current.delete(sessionId)
        }
      }
      refCallbacks.current.set(sessionId, cb)
    }
    return cb
  }, [])

  // Focus a specific session's terminal (called after Ctrl+Tab)
  const focusSessionTerminal = useCallback((sessionId: string) => {
    sessionRefs.current.get(sessionId)?.focusTerminal()
  }, [])

  const activeIndex = sessions.findIndex((s) => s.id === activeSessionId)

  const handleNextTab = useCallback(() => {
    if (sessions.length === 0) return undefined
    const nextIndex = (activeIndex + 1) % sessions.length
    const newSessionId = sessions[nextIndex].id
    setActiveSession(newSessionId)
    return newSessionId
  }, [sessions, activeIndex, setActiveSession])

  const handlePrevTab = useCallback(() => {
    if (sessions.length === 0) return undefined
    const prevIndex = (activeIndex - 1 + sessions.length) % sessions.length
    const newSessionId = sessions[prevIndex].id
    setActiveSession(newSessionId)
    return newSessionId
  }, [sessions, activeIndex, setActiveSession])

  const handleGoToTab = useCallback(
    (index: number) => {
      if (index >= 0 && index < sessions.length) {
        setActiveSession(sessions[index].id)
      }
    },
    [sessions, setActiveSession]
  )

  const handleCloseTab = useCallback(() => {
    if (activeSessionId) {
      closeSession(activeSessionId)
    }
  }, [activeSessionId, closeSession])

  // Handle Escape to close help
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showHelp])

  useKeyboardShortcuts({
    onNewTab: createSession,
    onCloseTab: handleCloseTab,
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onGoToTab: handleGoToTab,
    onShowHelp: () => setShowHelp(true),
    onTabSwitched: focusSessionTerminal,
  })

  return (
    <div className="h-screen flex flex-col bg-obsidian-bg relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian-void/50 via-transparent to-obsidian-void/30 pointer-events-none" />

      <TabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        waitingSessionIds={waitingIds}
        onTabSelect={setActiveSession}
        onTabClose={closeSession}
        onNewTab={createSession}
      />
      <div className="flex-1 min-h-0 relative">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className={session.id === activeSessionId ? 'h-full' : 'hidden'}
            >
              <Session
                ref={getRefCallback(session.id)}
                sessionId={session.id}
                cwd={session.cwd}
                diffCwd={sessionCwds.get(session.id) || session.cwd}
                gitRootHint={sessionGitRoots.get(session.id)}
                isActive={session.id === activeSessionId}
                onCloseSession={closeSession}
              />
            </div>
          ))
        ) : (
          <EmptyState onCreateSession={createSession} />
        )}
      </div>
      <HelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}
