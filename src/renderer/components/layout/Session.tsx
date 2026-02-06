import { memo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ResizableSplit } from './ResizableSplit'
import { Terminal, TerminalHandle } from '../terminal/Terminal'
import { DiffPanel } from '../diff/DiffPanel'

interface SessionProps {
  sessionId: string
  cwd: string
  diffCwd: string
  gitRootHint: string | null | undefined
  isActive?: boolean
  onCloseSession: (id: string) => void
}

export interface SessionHandle {
  focusTerminal: () => void
}

export const Session = memo(forwardRef<SessionHandle, SessionProps>(
  function Session({ sessionId, cwd, diffCwd, gitRootHint, isActive, onCloseSession }, ref) {
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
        left={<Terminal ref={terminalRef} sessionId={sessionId} cwd={cwd} onExit={handleExit} />}
        right={
          <DiffPanel
            sessionId={sessionId}
            cwd={diffCwd}
            gitRootHint={gitRootHint}
            isActive={!!isActive}
            onFocusTerminal={focusTerminal}
          />
        }
        initialRatio={0.5}
        minRatio={0.2}
        maxRatio={0.8}
      />
    </div>
  )
}))
