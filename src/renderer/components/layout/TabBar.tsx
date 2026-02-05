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

      {/* Draggable area for macOS */}
      <div className="w-20 flex-shrink-0 app-drag" />

      {/* Tabs container */}
      <div
        className="flex-1 flex items-end overflow-x-auto scrollbar-thin gap-0.5 pt-2"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            onNewTab()
          }
        }}
      >
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
      </div>

      {/* New tab button */}
      <button
        className="
          px-4 py-2.5 text-obsidian-text-muted hover:text-obsidian-accent
          transition-all duration-200 flex-shrink-0 group relative
        "
        onClick={onNewTab}
        title="New Tab (Ctrl+T)"
      >
        <svg
          className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-90"
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
