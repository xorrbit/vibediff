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
    <div className="flex bg-terminal-surface border-b border-terminal-border">
      {/* Draggable area for macOS */}
      <div className="w-20 flex-shrink-0 app-drag" />

      {/* Tabs container - double click empty space to create new tab */}
      <div
        className="flex-1 flex overflow-x-auto scrollbar-thin"
        onDoubleClick={(e) => {
          // Only create new tab if clicking on the container itself, not on a tab
          if (e.target === e.currentTarget) {
            onNewTab()
          }
        }}
      >
        {sessions.map((session) => (
          <Tab
            key={session.id}
            name={session.name}
            fullPath={session.cwd}
            isActive={session.id === activeSessionId}
            onSelect={() => onTabSelect(session.id)}
            onClose={() => onTabClose(session.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <button
        className="
          px-4 py-2 text-terminal-text-muted hover:text-terminal-text
          hover:bg-terminal-border transition-colors flex-shrink-0
        "
        onClick={onNewTab}
        title="New Tab (Ctrl+T)"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  )
}
