import { memo, useImperativeHandle, type Ref } from 'react'
import { useTerminal } from '../../hooks/useTerminal'

interface TerminalProps {
  sessionId: string
  cwd: string
  onExit?: () => void
  ref?: Ref<TerminalHandle>
}

export interface TerminalHandle {
  focus: () => void
}

export const Terminal = memo(
  function Terminal({ sessionId, cwd, onExit, ref }: TerminalProps) {
    const { terminalRef, focus } = useTerminal({ sessionId, cwd, onExit })

    useImperativeHandle(ref, () => ({
      focus,
    }), [focus])

    return (
      <div className="h-full w-full bg-obsidian-void xterm-container">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    )
  }
)
