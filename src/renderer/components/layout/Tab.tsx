import { memo, useCallback } from 'react'

interface TabProps {
  id: string
  name: string
  fullPath: string
  isActive: boolean
  isWaiting: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void | Promise<void>
  index: number
}

export const Tab = memo(function Tab({ id, name, fullPath, isActive, isWaiting, onSelect, onClose, index }: TabProps) {
  const handleSelect = useCallback(() => onSelect(id), [onSelect, id])
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose(id)
  }, [onClose, id])

  return (
    <button
      className={`
        relative flex items-center gap-2.5 px-4 py-2 text-sm
        transition-colors duration-200 ease-out-expo
        flex-1 min-w-[100px] max-w-[240px] group
        rounded-t-lg
        ${isActive
          ? 'bg-obsidian-bg text-obsidian-text'
          : isWaiting
            ? 'bg-obsidian-accent/8 text-obsidian-text-secondary hover:bg-obsidian-accent/12'
            : 'bg-transparent text-obsidian-text-muted hover:text-obsidian-text-secondary hover:bg-obsidian-elevated/50'
        }
      `}
      onClick={handleSelect}
      title={fullPath}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Active tab glow indicator */}
      {isActive && (
        <>
          {/* Top accent line */}
          <div
            className={`
              absolute top-0 left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-obsidian-accent to-transparent rounded-full
              opacity-100
            `}
          />
          {/* Bottom connection to content */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-obsidian-bg" />
        </>
      )}

      {/* Tab icon */}
      <div className="relative flex items-center">
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${
            isActive
              ? 'text-obsidian-accent'
              : isWaiting
                ? 'text-obsidian-modified animate-tab-waiting [filter:drop-shadow(0_0_4px_rgba(251,191,36,0.75))]'
                : 'text-obsidian-text-ghost'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <span className="truncate text-left font-medium flex-1 min-w-0">{name}</span>

      {/* Close button - visible on hover or when active, uses CSS group-hover */}
      <span
        className={`
          w-5 h-5 flex items-center justify-center rounded
          transition-colors transition-opacity duration-150
          hover:bg-obsidian-deleted/20 hover:text-obsidian-deleted
          ${isActive
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'
          }
        `}
        onClick={handleClose}
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </span>
    </button>
  )
})
