import { memo } from 'react'
import { ChangedFile, FileStatus } from '@shared/types'

interface FileListItemProps {
  file: ChangedFile
  isSelected: boolean
  onSelect: (path: string) => void
  index: number
  isCollapsed?: boolean
}

const STATUS_CONFIG: Record<FileStatus, { color: string; bg: string; label: string }> = {
  A: { color: 'text-obsidian-added', bg: 'bg-obsidian-added/15', label: 'Added' },
  M: { color: 'text-obsidian-modified', bg: 'bg-obsidian-modified/15', label: 'Modified' },
  D: { color: 'text-obsidian-deleted', bg: 'bg-obsidian-deleted/15', label: 'Deleted' },
  R: { color: 'text-obsidian-modified', bg: 'bg-obsidian-modified/15', label: 'Renamed' },
  '?': { color: 'text-obsidian-added', bg: 'bg-obsidian-added/15', label: 'Untracked' },
}

export const FileListItem = memo(function FileListItem({
  file,
  isSelected,
  onSelect,
  index,
  isCollapsed,
}: FileListItemProps) {
  const config = STATUS_CONFIG[file.status]

  // Get just the filename from the path
  const fileName = file.path.split('/').pop() || file.path
  // Get the directory path
  const dirPath = file.path.split('/').slice(0, -1).join('/')

  return (
    <button
      className={`
        w-full flex items-center gap-3 py-2 text-left
        ${isCollapsed ? 'px-2' : 'px-4'}
        transition-all duration-150 ease-out group relative
        ${isSelected
          ? 'bg-obsidian-accent/10'
          : 'hover:bg-obsidian-float/50'
        }
      `}
      onClick={() => onSelect(file.path)}
      title={`${file.path} (${config.label})`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-obsidian-accent rounded-r" />
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <span className={`
          text-sm truncate block font-medium
          ${isSelected ? 'text-obsidian-text' : 'text-obsidian-text-secondary group-hover:text-obsidian-text'}
          transition-colors duration-150
        `}>
          {fileName}
        </span>
        {dirPath && (
          <span className="text-2xs text-obsidian-text-secondary truncate block">
            {dirPath}
          </span>
        )}
      </div>

      {/* Status badge — hidden when collapsed */}
      {!isCollapsed && (
        <span className={`
          w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-2xs font-mono font-semibold
          ${config.color} ${config.bg}
          transition-transform duration-150 group-hover:scale-110
        `}>
          {file.status}
        </span>
      )}

      {/* Hover chevron — hidden when collapsed */}
      {!isCollapsed && (
        <svg
          className={`
            w-3.5 h-3.5 flex-shrink-0 transition-all duration-150
            ${isSelected
              ? 'text-obsidian-accent opacity-100'
              : 'text-obsidian-text-ghost opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0'
            }
          `}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
})
