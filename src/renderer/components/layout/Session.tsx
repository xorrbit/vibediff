import { memo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ResizableSplit } from './ResizableSplit'
import { Terminal, TerminalHandle } from '../terminal/Terminal'
import { DiffPanel } from '../diff/DiffPanel'

interface SessionProps {
  sessionId: string
  cwd: string
  isActive?: boolean
}

export interface SessionHandle {
  focusTerminal: () => void
}

export const Session = memo(forwardRef<SessionHandle, SessionProps>(
  function Session({ sessionId, cwd, isActive }, ref) {
  const terminalRef = useRef<TerminalHandle>(null)

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  useImperativeHandle(ref, () => ({
    focusTerminal,
  }), [focusTerminal])

  // Focus terminal when this session becomes active
  useEffect(() => {
    if (isActive) {
      // Delay to ensure terminal is visible and Tab key processing is complete
      // (Tab key can interfere with focus on Linux)
      const timer = setTimeout(() => {
        focusTerminal()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isActive, focusTerminal])

  return (
    <div className="h-full">
      <ResizableSplit
        left={<Terminal ref={terminalRef} sessionId={sessionId} cwd={cwd} />}
        right={<DiffPanel sessionId={sessionId} cwd={cwd} onFocusTerminal={focusTerminal} />}
        initialRatio={0.5}
        minRatio={0.2}
        maxRatio={0.8}
      />
    </div>
  )
}))
