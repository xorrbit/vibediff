import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { useGitDiff } from '../../hooks/useGitDiff'
import { useSessionContext } from '../../context/SessionContext'
import { FileList } from './FileList'
import { DiffView } from './DiffView'

interface DiffPanelProps {
  sessionId: string
  cwd: string
  onFocusTerminal?: () => void
}

export const DiffPanel = memo(function DiffPanel({ sessionId, cwd: initialCwd, onFocusTerminal }: DiffPanelProps) {
  // Get current CWD from context (tracked centrally to avoid duplicate polling)
  const { sessionCwds } = useSessionContext()
  const terminalCwd = sessionCwds.get(sessionId) || initialCwd

  const {
    files,
    selectedFile,
    diffContent,
    isLoading,
    isDiffLoading,
    error,
    selectFile,
    refresh,
  } = useGitDiff({ sessionId, cwd: terminalCwd })

  // Resizable floating panel — drag left edge to widen
  const COLLAPSED_WIDTH = 80
  const [fileListWidth, setFileListWidth] = useState(256)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleCollapsed = useCallback(() => setIsCollapsed(prev => !prev), [])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    document.body.classList.add('resizing')
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      // Panel's right edge is pinned to the DiffPanel's left edge
      const anchorX = containerRef.current.getBoundingClientRect().left
      const newWidth = anchorX - e.clientX
      setFileListWidth(Math.min(500, Math.max(180, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.classList.remove('resizing')
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('resizing')
    }
  }, [isResizing])

  // Wrapper that selects the file and returns focus to terminal
  const handleSelectFile = useCallback((path: string) => {
    selectFile(path)
    onFocusTerminal?.()
  }, [selectFile, onFocusTerminal])

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-obsidian-text-muted p-8">
        <div className="w-12 h-12 rounded-full bg-obsidian-deleted/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-obsidian-deleted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-center mb-4">{error}</p>
        <button
          className="text-xs text-obsidian-accent hover:text-obsidian-accent-dim transition-colors"
          onClick={refresh}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full relative bg-obsidian-bg">
      {/* Floating file list overlay - positioned over the terminal */}
      <div
        className="absolute top-0 right-full z-30 max-h-[50%]
                   flex flex-col rounded-bl-xl
                   bg-obsidian-bg
                   border-l border-b border-white/[0.06]
                   shadow-2xl
                   overflow-hidden
                   transition-[width] duration-200 ease-out"
        style={{ width: isCollapsed ? COLLAPSED_WIDTH : fileListWidth }}
      >
        {/* Left-edge resize handle — only when expanded */}
        {!isCollapsed && (
          <div
            className={`
              absolute inset-y-0 left-0 w-1.5 cursor-col-resize z-10 group/resize
              ${isResizing ? '' : 'hover:bg-white/[0.04]'}
            `}
            onMouseDown={handleResizeMouseDown}
          >
            <div className={`
              absolute inset-y-0 left-0 w-px transition-colors duration-150
              ${isResizing
                ? 'bg-obsidian-accent'
                : 'bg-transparent group-hover/resize:bg-obsidian-text-ghost'
              }
            `} />
          </div>
        )}
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-2.5 border-b border-obsidian-border-subtle/50 flex-shrink-0">
          {/* Collapse/expand toggle */}
          <button
            className="text-obsidian-text-muted hover:text-obsidian-accent p-1 rounded transition-all duration-200 hover:bg-obsidian-float/50 flex-shrink-0"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand file list' : 'Collapse file list'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={isCollapsed ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
          </button>
          {/* Refresh */}
          <button
            className="text-obsidian-text-muted hover:text-obsidian-accent p-1 rounded transition-all duration-200 hover:bg-obsidian-float/50 flex-shrink-0"
            onClick={refresh}
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          {/* Header text — clips naturally when collapsed */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-obsidian-accent animate-glow-pulse flex-shrink-0" />
            <span className="text-xs font-medium text-obsidian-text uppercase tracking-wider whitespace-nowrap">
              Changes
            </span>
            {files.length > 0 && (
              <span className="text-2xs font-mono text-obsidian-text-muted bg-obsidian-float/50 px-1.5 py-0.5 rounded flex-shrink-0">
                {files.length}
              </span>
            )}
          </div>
        </div>

        {/* File list - scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <FileList
            files={files}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            isLoading={isLoading}
            isCollapsed={isCollapsed}
          />
        </div>
      </div>

      {/* Diff view - full width */}
      <div className="h-full w-full overflow-hidden flex flex-col">
        {/* Selected file path */}
        {selectedFile && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-obsidian-border-subtle bg-obsidian-surface/30">
            <span className="text-xs font-mono text-obsidian-text-secondary truncate block">
              {selectedFile}
            </span>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <DiffView
            filePath={selectedFile}
            diffContent={diffContent}
            isLoading={isDiffLoading || (isLoading && !!selectedFile)}
          />
        </div>
      </div>
    </div>
  )
})
