import { useState, useCallback, useEffect, useRef } from 'react'
import { SessionProvider } from './context/SessionContext'
import { useSessions } from './hooks/useSessions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TabBar } from './components/layout/TabBar'
import { Session, SessionHandle } from './components/layout/Session'
import { EmptyState } from './components/common/EmptyState'
import { HelpOverlay } from './components/common/HelpOverlay'

function AppContent() {
  const {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    setActiveSession,
  } = useSessions()

  const [showHelp, setShowHelp] = useState(false)
  const sessionRefs = useRef<Map<string, SessionHandle>>(new Map())

  // Focus the active session's terminal (called after Ctrl+Tab on keyup)
  const focusActiveTerminal = useCallback(() => {
    if (activeSessionId) {
      sessionRefs.current.get(activeSessionId)?.focusTerminal()
    }
  }, [activeSessionId])

  const activeIndex = sessions.findIndex((s) => s.id === activeSessionId)

  const handleNextTab = useCallback(() => {
    if (sessions.length === 0) return
    const nextIndex = (activeIndex + 1) % sessions.length
    setActiveSession(sessions[nextIndex].id)
  }, [sessions, activeIndex, setActiveSession])

  const handlePrevTab = useCallback(() => {
    if (sessions.length === 0) return
    const prevIndex = (activeIndex - 1 + sessions.length) % sessions.length
    setActiveSession(sessions[prevIndex].id)
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

  // Handle menu events
  useEffect(() => {
    const unsubNewTab = window.electronAPI.menu.onNewTab(() => {
      createSession()
    })
    const unsubCloseTab = window.electronAPI.menu.onCloseTab(() => {
      handleCloseTab()
    })
    const unsubShowHelp = window.electronAPI.menu.onShowHelp(() => {
      setShowHelp(true)
    })

    return () => {
      unsubNewTab()
      unsubCloseTab()
      unsubShowHelp()
    }
  }, [createSession, handleCloseTab])

  useKeyboardShortcuts({
    onNewTab: createSession,
    onCloseTab: handleCloseTab,
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onGoToTab: handleGoToTab,
    onShowHelp: () => setShowHelp(true),
    onTabSwitched: focusActiveTerminal,
  })

  return (
    <div className="h-screen flex flex-col bg-obsidian-bg relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian-void/50 via-transparent to-obsidian-void/30 pointer-events-none" />

      <TabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
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
                ref={(handle) => {
                  if (handle) {
                    sessionRefs.current.set(session.id, handle)
                  } else {
                    sessionRefs.current.delete(session.id)
                  }
                }}
                sessionId={session.id}
                cwd={session.cwd}
                isActive={session.id === activeSessionId}
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
