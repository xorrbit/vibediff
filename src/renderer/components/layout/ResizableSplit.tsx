import { ReactNode } from 'react'
import { useResizable } from '../../hooks/useResizable'

interface ResizableSplitProps {
  left: ReactNode
  right: ReactNode
  initialRatio?: number
  minRatio?: number
  maxRatio?: number
}

export function ResizableSplit({
  left,
  right,
  initialRatio = 0.6,
  minRatio = 0.2,
  maxRatio = 0.8,
}: ResizableSplitProps) {
  const { ratio, isDragging, handleMouseDown } = useResizable({
    initialRatio,
    minRatio,
    maxRatio,
  })

  return (
    <div className="flex h-full w-full bg-obsidian-bg">
      {/* Left pane - Terminal */}
      <div
        className="h-full overflow-hidden relative"
        style={{ width: `${ratio * 100}%` }}
      >
        {/* Subtle inner shadow for depth */}
        <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_-8px_0_16px_-8px_rgba(0,0,0,0.3)]" />
        {left}
      </div>

      {/* Divider */}
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

      {/* Right pane - Diff panel */}
      <div
        className="h-full overflow-hidden relative"
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  )
}
