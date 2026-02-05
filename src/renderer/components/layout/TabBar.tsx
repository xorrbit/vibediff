import { Session } from '@shared/types'
import { Tab } from './Tab'

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
  return (
    <div className="relative flex items-stretch bg-obsidian-surface border-b border-obsidian-border-subtle z-10">
      {/* Subtle top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-obsidian-border to-transparent opacity-50" />

      {/* Draggable area for window movement */}
      <div className="w-40 flex-shrink-0 app-drag flex items-center pl-4">
        <span className="text-xs text-obsidian-text-muted font-medium">Claude Did What?!</span>
      </div>

      {/* Tabs container */}
      <div className="flex-1 flex items-end overflow-x-auto scrollbar-thin gap-0.5 pt-2">
        {sessions.map((session, index) => (
          <Tab
            key={session.id}
            name={session.name}
            fullPath={session.cwd}
            isActive={session.id === activeSessionId}
            onSelect={() => onTabSelect(session.id)}
            onClose={() => onTabClose(session.id)}
            index={index}
          />
        ))}

        {/* Empty space after tabs - double-click to open new tab */}
        <div
          className="flex-1 min-w-[100px] h-full"
          onDoubleClick={onNewTab}
        />
      </div>

      {/* Window controls */}
      <div className="flex items-center flex-shrink-0 ml-2">
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
