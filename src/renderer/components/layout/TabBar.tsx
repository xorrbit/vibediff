import { memo, type MouseEvent as ReactMouseEvent, type WheelEvent, useCallback, useEffect, useRef } from 'react'
import { Session } from '@shared/types'
import { Tab } from './Tab'
import logoPng from '../../../../resources/icon.png'

export type TabPosition = 'top' | 'left'

interface TabBarProps {
  sessions: Session[]
  activeSessionId: string | null
  waitingSessionIds: Set<string>
  automationEnabled?: boolean
  position?: TabPosition
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void | Promise<void>
  onNewTab: () => void
  onOpenSettings?: () => void
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export const TabBar = memo(function TabBar({
  sessions,
  activeSessionId,
  waitingSessionIds,
  automationEnabled = false,
  position = 'top',
  onTabSelect,
  onTabClose,
  onNewTab,
  onOpenSettings,
  onReorder,
}: TabBarProps) {
  const dragStateRef = useRef<{
    startMouseX: number
    startMouseY: number
    startWindowX: number
    startWindowY: number
    hasMoved: boolean
  } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)
  const suppressDoubleClickUntilRef = useRef(0)
  const dragRequestCounterRef = useRef(0)
  const activeDragRequestRef = useRef<number | null>(null)

  const flushPendingWindowPosition = useCallback(() => {
    const pending = pendingPositionRef.current
    animationFrameRef.current = null
    if (!pending) return
    pendingPositionRef.current = null
    window.electronAPI.window.setPosition(pending.x, pending.y)
  }, [])

  const queueWindowPosition = useCallback((x: number, y: number) => {
    pendingPositionRef.current = { x, y }
    if (animationFrameRef.current !== null) return
    animationFrameRef.current = window.requestAnimationFrame(flushPendingWindowPosition)
  }, [flushPendingWindowPosition])

  const endManualDrag = useCallback(() => {
    activeDragRequestRef.current = null
    if (!dragStateRef.current) return
    if (dragStateRef.current.hasMoved) {
      suppressDoubleClickUntilRef.current = Date.now() + 250
    }
    dragStateRef.current = null
  }, [])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return

      const deltaX = event.screenX - dragState.startMouseX
      const deltaY = event.screenY - dragState.startMouseY

      if (!dragState.hasMoved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        return
      }

      dragState.hasMoved = true
      queueWindowPosition(
        dragState.startWindowX + deltaX,
        dragState.startWindowY + deltaY,
      )
    }

    const handleMouseUp = () => {
      endManualDrag()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleMouseUp)
    }
  }, [endManualDrag, queueWindowPosition])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current === null) return
      window.cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const handleEmptyAreaMouseDown = useCallback(async (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()

    const requestId = ++dragRequestCounterRef.current
    activeDragRequestRef.current = requestId
    const startMouseX = event.screenX
    const startMouseY = event.screenY

    const { x, y } = await window.electronAPI.window.getPosition()
    if (activeDragRequestRef.current !== requestId) return

    dragStateRef.current = {
      startMouseX,
      startMouseY,
      startWindowX: x,
      startWindowY: y,
      hasMoved: false,
    }
  }, [])

  const handleEmptyAreaDoubleClick = useCallback(() => {
    if (Date.now() < suppressDoubleClickUntilRef.current) return
    onNewTab()
  }, [onNewTab])

  const handleTabsWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return
    e.currentTarget.scrollLeft += e.deltaY
  }, [])

  // ---------- Left sidebar layout ----------
  if (position === 'left') {
    return (
      <div className="w-[200px] flex-shrink-0 flex flex-col bg-obsidian-surface border-r border-obsidian-border-subtle z-10 relative">
        {/* Subtle left highlight */}
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-obsidian-border to-transparent opacity-50" />

        {/* Vertical tabs list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col gap-0.5 py-1">
          {sessions.map((session, index) => (
            <Tab
              key={session.id}
              id={session.id}
              name={session.name}
              fullPath={session.cwd}
              isActive={session.id === activeSessionId}
              isWaiting={waitingSessionIds.has(session.id)}
              onSelect={onTabSelect}
              onClose={onTabClose}
              index={index}
              vertical
              onReorder={onReorder}
            />
          ))}

          {/* Empty space — double-click to open new tab */}
          <div
            className="flex-1 min-h-[40px]"
            data-testid="tabbar-empty-space"
            onMouseDown={handleEmptyAreaMouseDown}
            onDoubleClick={handleEmptyAreaDoubleClick}
          />
        </div>

        {/* New tab + Settings pinned at bottom */}
        <div className="flex-shrink-0 border-t border-obsidian-border-subtle">
          <button
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-obsidian-text-muted hover:text-obsidian-accent hover:bg-obsidian-accent-subtle transition-colors"
            onClick={onNewTab}
            title="New tab"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">New Tab</span>
          </button>
          <button
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-obsidian-text-muted hover:text-obsidian-accent hover:bg-obsidian-accent-subtle transition-colors"
            onClick={onOpenSettings}
            title="Settings"
          >
            <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="8" x2="21" y2="8" />
              <line x1="3" y1="16" x2="21" y2="16" />
              <circle cx="9" cy="8" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
            </svg>
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </div>
    )
  }

  // ---------- Top tab bar layout (default) ----------
  return (
    <div className="relative flex items-stretch bg-obsidian-surface border-b border-obsidian-border-subtle z-10">
      {/* Subtle top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-obsidian-border to-transparent opacity-50" />

      {/* Draggable area for window movement */}
      <div className="w-44 flex-shrink-0 app-drag flex items-center gap-2.5 pl-3">
        <img src={logoPng} alt="" className="w-7 h-7 rounded-md flex-shrink-0" draggable={false} />
        <div className="flex flex-col justify-center">
          <span className="text-xs text-obsidian-text-muted font-medium leading-tight">Claude Did What?!</span>
          <span className="text-[9px] text-obsidian-text-muted/50 leading-tight">AI slop by Andrew Orr</span>
        </div>
      </div>

      {automationEnabled && (
        <div
          className="mx-1 mt-2 h-6 px-2.5 rounded-full border border-obsidian-accent/40 bg-obsidian-accent-subtle text-obsidian-accent text-[10px] font-semibold tracking-wide uppercase flex items-center gap-1.5 select-none app-drag"
          title="Automation API enabled"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-obsidian-accent animate-glow-pulse" />
          API
        </div>
      )}

      {/* Tabs container */}
      <div className="flex-1 flex items-end overflow-x-auto scrollbar-thin gap-0.5 pt-2" onWheel={handleTabsWheel}>
        {sessions.map((session, index) => (
          <Tab
            key={session.id}
            id={session.id}
            name={session.name}
            fullPath={session.cwd}
            isActive={session.id === activeSessionId}
            isWaiting={waitingSessionIds.has(session.id)}
            onSelect={onTabSelect}
            onClose={onTabClose}
            index={index}
            onReorder={onReorder}
          />
        ))}

        {/* Empty space after tabs - double-click to open new tab */}
        <div
          className="flex-1 min-w-[40px] h-full app-no-drag"
          data-testid="tabbar-empty-space"
          onMouseDown={handleEmptyAreaMouseDown}
          onDoubleClick={handleEmptyAreaDoubleClick}
        />
      </div>

      {/* Settings + Window controls */}
      <div className="flex items-center flex-shrink-0">
        {/* Settings */}
        <button
          className="w-11 h-9 flex items-center justify-center text-obsidian-text-muted hover:text-obsidian-accent hover:bg-obsidian-accent-subtle transition-colors"
          onClick={onOpenSettings}
          title="Settings"
        >
          <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="8" x2="21" y2="8" />
            <line x1="3" y1="16" x2="21" y2="16" />
            <circle cx="9" cy="8" r="2.5" fill="currentColor" stroke="none" />
            <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <div className="w-px h-4 bg-obsidian-border-subtle mx-0.5" />

        {/* Minimize */}
        <button
          className="w-11 h-9 flex items-center justify-center text-obsidian-text-muted hover:bg-obsidian-hover transition-colors"
          onClick={() => window.electronAPI.window.minimize()}
          title="Minimize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Maximize */}
        <button
          className="w-11 h-9 flex items-center justify-center text-obsidian-text-muted hover:bg-obsidian-hover transition-colors"
          onClick={() => window.electronAPI.window.maximize()}
          title="Maximize"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="1" strokeWidth={2} />
          </svg>
        </button>

        {/* Close */}
        <button
          className="w-11 h-9 flex items-center justify-center text-obsidian-text-muted hover:bg-red-600 hover:text-white transition-colors"
          onClick={() => window.electronAPI.window.close()}
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
})
