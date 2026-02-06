import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef } from 'react'
import { Session } from '@shared/types'
import { Tab } from './Tab'
import logoPng from '../../../../assets/claudedidwhat.png'

interface TabBarProps {
  sessions: Session[]
  activeSessionId: string | null
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
  onNewTab: () => void
}

export function TabBar({
  sessions,
  activeSessionId,
  onTabSelect,
  onTabClose,
  onNewTab,
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

  return (
    <div className="relative flex items-stretch bg-obsidian-surface border-b border-obsidian-border-subtle z-10">
      {/* Subtle top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-obsidian-border to-transparent opacity-50" />

      {/* Draggable area for window movement */}
      <div className="w-52 flex-shrink-0 app-drag flex items-center gap-2.5 pl-3">
        <img src={logoPng} alt="" className="w-7 h-7 rounded-md flex-shrink-0" draggable={false} />
        <div className="flex flex-col justify-center">
          <span className="text-xs text-obsidian-text-muted font-medium leading-tight">Claude Did What?!</span>
          <span className="text-[9px] text-obsidian-text-muted/50 leading-tight">AI slop by Andrew Orr</span>
        </div>
      </div>

      {/* Tabs container */}
      <div className="flex-1 flex items-end overflow-x-auto scrollbar-thin gap-0.5 pt-2">
        {sessions.map((session, index) => (
          <Tab
            key={session.id}
            id={session.id}
            name={session.name}
            fullPath={session.cwd}
            isActive={session.id === activeSessionId}
            onSelect={onTabSelect}
            onClose={onTabClose}
            index={index}
          />
        ))}

        {/* Empty space after tabs - double-click to open new tab */}
        <div
          className="flex-1 min-w-[100px] h-full app-no-drag"
          data-testid="tabbar-empty-space"
          onMouseDown={handleEmptyAreaMouseDown}
          onDoubleClick={handleEmptyAreaDoubleClick}
        />
      </div>

      {/* Draggable area on right side */}
      <div className="w-36 flex-shrink-0 app-drag flex items-center justify-center px-2">
        <svg className="w-full h-5 text-obsidian-text-muted/20" viewBox="0 0 120 20" fill="currentColor" preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: 15 }, (_, i) => (
            <g key={i}>
              <circle cx={4 + i * 8} cy="2" r="1.2" />
              <circle cx={4 + i * 8} cy="8" r="1.2" />
              <circle cx={4 + i * 8} cy="14" r="1.2" />
              <circle cx={4 + i * 8} cy="20" r="1.2" />
            </g>
          ))}
        </svg>
      </div>

      {/* Window controls */}
      <div className="flex items-center flex-shrink-0">
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
}
