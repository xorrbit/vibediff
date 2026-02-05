import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { useGitDiff } from '../../hooks/useGitDiff'
import { useResizable } from '../../hooks/useResizable'
import { FileList } from './FileList'
import { DiffView } from './DiffView'

interface DiffPanelProps {
  sessionId: string
  cwd: string
  onFocusTerminal?: () => void
}

export const DiffPanel = memo(function DiffPanel({ sessionId, cwd: initialCwd, onFocusTerminal }: DiffPanelProps) {
  // Track the terminal's current working directory
  const [terminalCwd, setTerminalCwd] = useState(initialCwd)
  const cwdRef = useRef(terminalCwd)

  // Keep ref in sync
  useEffect(() => {
    cwdRef.current = terminalCwd
  }, [terminalCwd])

  // Poll for terminal cwd changes
  useEffect(() => {
    const pollCwd = async () => {
      try {
        const cwd = await window.electronAPI.pty.getCwd(sessionId)
        if (cwd && cwd !== cwdRef.current) {
          setTerminalCwd(cwd)
        }
      } catch {
        // Ignore errors
      }
    }

    // Poll immediately and then every 2 seconds
    pollCwd()
    const interval = setInterval(pollCwd, 2000)

    return () => clearInterval(interval)
  }, [sessionId])

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

  const { ratio, isDragging, handleMouseDown } = useResizable({
    initialRatio: 0.35,
    minRatio: 0.15,
    maxRatio: 0.5,
  })

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
    <div className="h-full flex bg-obsidian-bg">
      {/* File list sidebar */}
      <div
        className="flex-shrink-0 flex flex-col bg-obsidian-surface/30"
        style={{ width: `${ratio * 100}%` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border-subtle">
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-obsidian-accent animate-glow-pulse" />
              <span className="text-xs font-medium text-obsidian-text uppercase tracking-wider">
                Changes
              </span>
              {files.length > 0 && (
                <span className="text-2xs font-mono text-obsidian-text-muted bg-obsidian-float px-1.5 py-0.5 rounded">
                  {files.length}
                </span>
              )}
            </div>
            <span className="text-2xs text-obsidian-text-ghost truncate pl-3.5" title={terminalCwd}>
              {terminalCwd.split('/').slice(-2).join('/')}
            </span>
          </div>
          <button
            className="text-obsidian-text-muted hover:text-obsidian-accent p-1.5 rounded transition-all duration-200 hover:bg-obsidian-float"
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
        </div>

        {/* File list - scrollable */}
        <div className="flex-1 overflow-y-auto">
          <FileList
            files={files}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Resizable divider */}
      <div
        className={`
          relative w-px cursor-col-resize flex-shrink-0 group
          ${isDragging ? 'w-0.5' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        {/* Base line */}
        <div className={`
          absolute inset-y-0 left-0 w-px
          transition-all duration-200
          ${isDragging
            ? 'bg-obsidian-accent shadow-glow'
            : 'bg-obsidian-border-subtle group-hover:bg-obsidian-accent/50'
          }
        `} />

        {/* Hover/drag indicator - wider hit area */}
        <div className="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize" />

        {/* Grab handle indicator on hover */}
        <div className={`
          absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-8
          flex flex-col items-center justify-center gap-0.5
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          ${isDragging ? 'opacity-100' : ''}
        `}>
          <div className={`w-0.5 h-0.5 rounded-full ${isDragging ? 'bg-obsidian-accent' : 'bg-obsidian-text-muted'}`} />
          <div className={`w-0.5 h-0.5 rounded-full ${isDragging ? 'bg-obsidian-accent' : 'bg-obsidian-text-muted'}`} />
          <div className={`w-0.5 h-0.5 rounded-full ${isDragging ? 'bg-obsidian-accent' : 'bg-obsidian-text-muted'}`} />
        </div>
      </div>

      {/* Diff view */}
      <div
        className="min-h-0 min-w-0 bg-obsidian-bg"
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        <DiffView
          filePath={selectedFile}
          diffContent={diffContent}
          isLoading={isDiffLoading || (isLoading && !!selectedFile)}
        />
      </div>
    </div>
  )
})
