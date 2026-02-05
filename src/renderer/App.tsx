import { useState, useCallback, useEffect } from 'react'
import { SessionProvider } from './context/SessionContext'
import { useSessions } from './hooks/useSessions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { TabBar } from './components/layout/TabBar'
import { Session } from './components/layout/Session'
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
  })

  return (
    <div className="h-screen flex flex-col bg-terminal-bg">
      <TabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onTabSelect={setActiveSession}
        onTabClose={closeSession}
        onNewTab={createSession}
      />
      <div className="flex-1 min-h-0">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className={session.id === activeSessionId ? 'h-full' : 'hidden'}
            >
              <Session session={session} />
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
