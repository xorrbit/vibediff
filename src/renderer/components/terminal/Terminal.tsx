import { memo } from 'react'
import { useTerminal } from '../../hooks/useTerminal'

interface TerminalProps {
  sessionId: string
  cwd: string
}

export const Terminal = memo(function Terminal({ sessionId, cwd }: TerminalProps) {
  const { terminalRef } = useTerminal({ sessionId, cwd })

  return (
    <div className="h-full w-full bg-obsidian-void xterm-container">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  )
})
