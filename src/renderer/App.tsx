import { useState, useCallback, useEffect, useRef } from 'react'
import { SessionProvider } from './context/SessionContext'
import { useSessions } from './hooks/useSessions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useInputWaiting } from './hooks/useInputWaiting'
import { TabBar } from './components/layout/TabBar'
import { Session, SessionHandle } from './components/layout/Session'
import { EmptyState } from './components/common/EmptyState'
import { HelpOverlay } from './components/common/HelpOverlay'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { SettingsModal } from './components/common/SettingsModal'
import type { DiffViewMode } from './components/diff/DiffView'

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
  const [showSettings, setShowSettings] = useState(false)
  const [automationEnabled, setAutomationEnabled] = useState(false)
  const [pendingCloseSessionId, setPendingCloseSessionId] = useState<string | null>(null)

  // UI scale (persisted to localStorage, applied to root font-size)
  const [uiScale, setUiScale] = useState(() => {
    const stored = localStorage.getItem('cdw-ui-scale')
    return stored ? parseFloat(stored) : 1.0
  })

  // Diff view mode (persisted to localStorage)
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>(() => {
    const stored = localStorage.getItem('cdw-diff-view-mode')
    return (stored === 'unified' || stored === 'split' || stored === 'auto') ? stored : 'unified'
  })

  const handleDiffViewModeChange = useCallback((mode: DiffViewMode) => {
    setDiffViewMode(mode)
    localStorage.setItem('cdw-diff-view-mode', mode)
    window.dispatchEvent(new CustomEvent('diff-view-mode-change', { detail: { mode } }))
  }, [])

  const handleUiScaleChange = useCallback((scale: number) => {
    setUiScale(scale)
    localStorage.setItem('cdw-ui-scale', String(scale))
    document.documentElement.style.fontSize = `${16 * scale}px`
    window.dispatchEvent(new CustomEvent('ui-scale-change', { detail: { scale } }))
  }, [])

  // Apply stored scale on mount
  useEffect(() => {
    if (uiScale !== 1.0) {
      document.documentElement.style.fontSize = `${16 * uiScale}px`
    }
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
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

  const guardedCloseSession = useCallback(async (id: string) => {
    try {
      const processName = await window.electronAPI.pty.getForegroundProcess(id)
      if (processName === 'claude' || processName === 'codex') {
        setPendingCloseSessionId(id)
        return
      }
    } catch {
      // If we can't detect the process, close without prompting
    }
    closeSession(id)
  }, [closeSession])

  const handleConfirmClose = useCallback(() => {
    if (pendingCloseSessionId) {
      closeSession(pendingCloseSessionId)
      setPendingCloseSessionId(null)
    }
  }, [pendingCloseSessionId, closeSession])

  const handleCancelClose = useCallback(() => {
    setPendingCloseSessionId(null)
  }, [])

  const handleCloseTab = useCallback(() => {
    if (activeSessionId) {
      guardedCloseSession(activeSessionId)
    }
  }, [activeSessionId, guardedCloseSession])

  // Handle Escape to close overlays
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pendingCloseSessionId !== null) {
        setPendingCloseSessionId(null)
      } else if (showSettings) {
        setShowSettings(false)
      } else if (showHelp) {
        setShowHelp(false)
      }
    }
    // Capture phase ensures Escape is seen even when focused widgets (like xterm)
    // intercept bubbling keydown events.
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [showHelp, showSettings, pendingCloseSessionId])

  useEffect(() => {
    let cancelled = false
    window.electronAPI.automation.getStatus()
      .then((status) => {
        if (!cancelled) setAutomationEnabled(status.enabled)
      })
      .catch(() => {
        if (!cancelled) setAutomationEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAutomationToggle = useCallback(async (enabled: boolean) => {
    const status = await window.electronAPI.automation.setEnabled(enabled)
    setAutomationEnabled(status.enabled)
  }, [])

  const handleShowHelp = useCallback(() => setShowHelp(true), [])
  const handleHideHelp = useCallback(() => setShowHelp(false), [])
  const handleToggleSettings = useCallback(() => setShowSettings((s) => !s), [])
  const handleShowSettings = useCallback(() => setShowSettings(true), [])
  const handleHideSettings = useCallback(() => setShowSettings(false), [])

  useKeyboardShortcuts({
    onNewTab: createSession,
    onCloseTab: handleCloseTab,
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onGoToTab: handleGoToTab,
    onShowHelp: handleShowHelp,
    onOpenSettings: handleToggleSettings,
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
        automationEnabled={automationEnabled}
        onTabSelect={setActiveSession}
        onTabClose={guardedCloseSession}
        onNewTab={createSession}
        onOpenSettings={handleShowSettings}
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
                bootstrapCommands={session.bootstrapCommands}
                diffCwd={sessionCwds.get(session.id) || session.cwd}
                gitRootHint={sessionGitRoots.get(session.id)}
                isActive={session.id === activeSessionId}
                onCloseSession={closeSession}
                diffViewMode={diffViewMode}
                onDiffViewModeChange={handleDiffViewModeChange}
              />
            </div>
          ))
        ) : (
          <EmptyState onCreateSession={createSession} />
        )}
      </div>
      <HelpOverlay isOpen={showHelp} onClose={handleHideHelp} />
      <SettingsModal
        isOpen={showSettings}
        onClose={handleHideSettings}
        uiScale={uiScale}
        onUiScaleChange={handleUiScaleChange}
        diffViewMode={diffViewMode}
        onDiffViewModeChange={handleDiffViewModeChange}
        automationEnabled={automationEnabled}
        onAutomationToggle={handleAutomationToggle}
      />
      <ConfirmDialog
        isOpen={pendingCloseSessionId !== null}
        title="AI process running"
        message="Claude or Codex is still running in this tab. Are you sure you want to close it?"
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
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
