import { memo, useRef, useCallback, useEffect, useImperativeHandle, type Ref } from 'react'
import { ResizableSplit } from './ResizableSplit'
import { Terminal, TerminalHandle } from '../terminal/Terminal'
import { DiffPanel } from '../diff/DiffPanel'
import type { DiffViewMode } from '../diff/DiffView'

interface SessionProps {
  sessionId: string
  cwd: string
  bootstrapCommands?: string[]
  diffCwd: string
  gitRootHint: string | null | undefined
  isActive?: boolean
  onCloseSession: (id: string) => void
  diffViewMode: DiffViewMode
  onDiffViewModeChange: (mode: DiffViewMode) => void
  wordWrap: boolean
  onWordWrapChange: (enabled: boolean) => void
  ref?: Ref<SessionHandle>
}

export interface SessionHandle {
  focusTerminal: () => void
}

export const Session = memo(
  function Session({ sessionId, cwd, bootstrapCommands, diffCwd, gitRootHint, isActive, onCloseSession, diffViewMode, onDiffViewModeChange, wordWrap, onWordWrapChange, ref }: SessionProps) {
  const terminalRef = useRef<TerminalHandle>(null)

  const handleExit = useCallback(() => {
    onCloseSession(sessionId)
  }, [onCloseSession, sessionId])

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  useImperativeHandle(ref, () => ({
    focusTerminal,
  }), [focusTerminal])

  // Focus terminal when this session becomes active
  useEffect(() => {
    if (isActive) {
      // Use rAF to wait for next paint frame before focusing
      const frameId = requestAnimationFrame(() => {
        focusTerminal()
      })
      return () => cancelAnimationFrame(frameId)
    }
  }, [isActive, focusTerminal])

  return (
    <div className="h-full">
      <ResizableSplit
        left={(
          <Terminal
            ref={terminalRef}
            sessionId={sessionId}
            cwd={cwd}
            bootstrapCommands={bootstrapCommands}
            onExit={handleExit}
          />
        )}
        right={
          <DiffPanel
            sessionId={sessionId}
            cwd={diffCwd}
            gitRootHint={gitRootHint}
            isActive={!!isActive}
            onFocusTerminal={focusTerminal}
            diffViewMode={diffViewMode}
            onDiffViewModeChange={onDiffViewModeChange}
            wordWrap={wordWrap}
            onWordWrapChange={onWordWrapChange}
          />
        }
        initialRatio={0.5}
        minRatio={0.2}
        maxRatio={0.8}
      />
    </div>
  )
})
