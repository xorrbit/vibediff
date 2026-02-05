import { memo, useState, useEffect, useRef } from 'react'
import { useGitDiff } from '../../hooks/useGitDiff'
import { FileList } from './FileList'
import { DiffView } from './DiffView'

interface DiffPanelProps {
  sessionId: string
  cwd: string
}

export const DiffPanel = memo(function DiffPanel({ sessionId, cwd: initialCwd }: DiffPanelProps) {
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

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-terminal-text-muted p-4">
        <p className="text-sm">{error}</p>
        <button
          className="mt-2 text-xs text-terminal-accent hover:underline"
          onClick={refresh}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border">
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-terminal-text-muted uppercase tracking-wide">
            Changes
          </span>
          <span className="text-xs text-terminal-text-muted truncate" title={terminalCwd}>
            {terminalCwd.split('/').slice(-2).join('/')}
          </span>
        </div>
        <button
          className="text-terminal-text-muted hover:text-terminal-text p-1"
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

      {/* File list */}
      <div className="border-b border-terminal-border">
        <FileList
          files={files}
          selectedFile={selectedFile}
          onSelectFile={selectFile}
          isLoading={isLoading}
        />
      </div>

      {/* Diff view */}
      <div className="flex-1 min-h-0">
        <DiffView
          filePath={selectedFile}
          diffContent={diffContent}
          isLoading={isDiffLoading || (isLoading && !!selectedFile)}
        />
      </div>
    </div>
  )
})
