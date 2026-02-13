import { useState, useCallback, useEffect, useRef } from 'react'
import { SessionProvider } from './context/SessionContext'
import { useSessions } from './hooks/useSessions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useInputWaiting } from './hooks/useInputWaiting'
import { TabBar, type TabPosition } from './components/layout/TabBar'
import { WindowControlsBar } from './components/layout/WindowControlsBar'
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
    reorderSession,
  } = useSessions()
  const waitingIds = useInputWaiting(sessions, activeSessionId)

  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [automationEnabled, setAutomationEnabled] = useState(false)
  const [pendingCloseSessionId, setPendingCloseSessionId] = useState<string | null>(null)
  const [pendingSubdirOpen, setPendingSubdirOpen] = useState<{ parentDir: string; subdirs: string[] } | null>(null)

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

  // Tab position (persisted to localStorage)
  const [tabPosition, setTabPosition] = useState<TabPosition>(() => {
    const stored = localStorage.getItem('cdw-tab-position')
    return (stored === 'top' || stored === 'left') ? stored : 'top'
  })

  const handleTabPositionChange = useCallback((position: TabPosition) => {
    setTabPosition(position)
    localStorage.setItem('cdw-tab-position', position)
  }, [])

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
      if (pendingSubdirOpen !== null) {
        setPendingSubdirOpen(null)
      } else if (pendingCloseSessionId !== null) {
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
  }, [showHelp, showSettings, pendingCloseSessionId, pendingSubdirOpen])

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

  // Handle "Open tabs for subdirectories" context menu action
  useEffect(() => {
    return window.electronAPI.terminal.onContextMenuAction(async (sessionId, action) => {
      if (action !== 'openSubdirTabs') return
      const cwd = sessionCwds.get(sessionId)
      if (!cwd) return
      try {
        const subdirs = await window.electronAPI.fs.listSubdirectories(cwd)
        if (subdirs.length > 0) {
          setPendingSubdirOpen({ parentDir: cwd, subdirs })
        }
      } catch {
        // Silently ignore errors (e.g. permission denied)
      }
    })
  }, [sessionCwds])

  const handleConfirmSubdirOpen = useCallback(async () => {
    if (!pendingSubdirOpen) return
    const { parentDir, subdirs } = pendingSubdirOpen
    setPendingSubdirOpen(null)
    for (const subdir of subdirs) {
      await createSession(`${parentDir}/${subdir}`)
    }
  }, [pendingSubdirOpen, createSession])

  const handleCancelSubdirOpen = useCallback(() => {
    setPendingSubdirOpen(null)
  }, [])

  const handleAutomationToggle = useCallback(async (enabled: boolean) => {
    const status = await window.electronAPI.automation.setEnabled(enabled)
    setAutomationEnabled(status.enabled)
    return status
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

  const tabBar = (
    <TabBar
      sessions={sessions}
      activeSessionId={activeSessionId}
      waitingSessionIds={waitingIds}
      automationEnabled={automationEnabled}
      position={tabPosition}
      onTabSelect={setActiveSession}
      onTabClose={guardedCloseSession}
      onNewTab={createSession}
      onOpenSettings={handleShowSettings}
      onReorder={reorderSession}
    />
  )

  const content = (
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
  )

  return (
    <div className="h-screen flex flex-col bg-obsidian-bg relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian-void/50 via-transparent to-obsidian-void/30 pointer-events-none" />

      {tabPosition === 'left' && <WindowControlsBar automationEnabled={automationEnabled} />}
      <div className={`flex-1 min-h-0 flex ${tabPosition === 'left' ? 'flex-row' : 'flex-col'}`}>
        {tabBar}
        {content}
      </div>

      <HelpOverlay isOpen={showHelp} onClose={handleHideHelp} />
      <SettingsModal
        isOpen={showSettings}
        onClose={handleHideSettings}
        uiScale={uiScale}
        onUiScaleChange={handleUiScaleChange}
        diffViewMode={diffViewMode}
        onDiffViewModeChange={handleDiffViewModeChange}
        tabPosition={tabPosition}
        onTabPositionChange={handleTabPositionChange}
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
      <ConfirmDialog
        isOpen={pendingSubdirOpen !== null}
        title="Open tabs for subdirectories"
        confirmLabel={`Open ${pendingSubdirOpen?.subdirs.length ?? 0} tabs`}
        cancelLabel="Cancel"
        confirmClassName="px-4 py-2 text-sm font-medium text-obsidian-accent bg-obsidian-accent/10 hover:bg-obsidian-accent/20 rounded-lg border border-obsidian-accent/20 transition-colors"
        message={
          pendingSubdirOpen ? (
            <div>
              <p className="mb-3">
                Open a new tab for each subdirectory of{' '}
                <span className="font-mono text-obsidian-text">{pendingSubdirOpen.parentDir}</span>?
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-obsidian-surface border border-obsidian-border-subtle p-2">
                {pendingSubdirOpen.subdirs.map((dir) => (
                  <div key={dir} className="font-mono text-xs text-obsidian-text py-0.5 px-2">
                    {dir}/
                  </div>
                ))}
              </div>
            </div>
          ) : ''
        }
        onConfirm={handleConfirmSubdirOpen}
        onCancel={handleCancelSubdirOpen}
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
