import { memo, useCallback, useRef, useState } from 'react'

interface TabProps {
  id: string
  name: string
  fullPath: string
  isActive: boolean
  isWaiting: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void | Promise<void>
  index: number
  vertical?: boolean
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export const Tab = memo(function Tab({ id, name, fullPath, isActive, isWaiting, onSelect, onClose, index, vertical, onReorder }: TabProps) {
  const handleSelect = useCallback(() => onSelect(id), [onSelect, id])
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose(id)
  }, [onClose, id])

  const [isDragging, setIsDragging] = useState(false)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }, [index])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setDropPosition(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    if (vertical) {
      const midY = rect.top + rect.height / 2
      setDropPosition(e.clientY < midY ? 'before' : 'after')
    } else {
      const midX = rect.left + rect.width / 2
      setDropPosition(e.clientX < midX ? 'before' : 'after')
    }
  }, [vertical])

  const handleDragLeave = useCallback(() => {
    setDropPosition(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDropPosition(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (isNaN(fromIndex) || !onReorder) return
    let toIndex = index
    // If dragging forward and dropping "after", the visual target is index itself
    // If dragging backward and dropping "before", same logic applies
    // We need to account for the removal of the source element
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const isBeforeCenter = vertical
      ? e.clientY < rect.top + rect.height / 2
      : e.clientX < rect.left + rect.width / 2
    if (fromIndex < index) {
      toIndex = isBeforeCenter ? index - 1 : index
    } else if (fromIndex > index) {
      toIndex = isBeforeCenter ? index : index + 1
    } else {
      return // same position
    }
    onReorder(fromIndex, toIndex)
  }, [index, vertical, onReorder])

  return (
    <button
      ref={buttonRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex items-center gap-2.5 px-4 py-2 text-sm
        transition-colors duration-200 ease-out-expo group
        ${vertical
          ? 'w-full rounded-l-lg flex-shrink-0'
          : 'flex-1 min-w-[100px] max-w-[240px] rounded-t-lg'
        }
        ${isActive
          ? 'bg-obsidian-bg text-obsidian-text'
          : isWaiting
            ? 'bg-obsidian-accent/8 text-obsidian-text-secondary hover:bg-obsidian-accent/12'
            : 'bg-transparent text-obsidian-text-muted hover:text-obsidian-text-secondary hover:bg-obsidian-elevated/50'
        }
        ${isDragging ? 'opacity-50' : ''}
      `}
      onClick={handleSelect}
      title={fullPath}
      style={vertical ? undefined : { animationDelay: `${index * 50}ms` }}
    >
      {/* Drop indicator */}
      {dropPosition === 'before' && (
        <div className={`absolute ${vertical
          ? 'top-0 left-1 right-1 h-0.5 -translate-y-px'
          : 'left-0 top-1 bottom-1 w-0.5 -translate-x-px'
        } bg-obsidian-accent rounded-full`} />
      )}
      {dropPosition === 'after' && (
        <div className={`absolute ${vertical
          ? 'bottom-0 left-1 right-1 h-0.5 translate-y-px'
          : 'right-0 top-1 bottom-1 w-0.5 translate-x-px'
        } bg-obsidian-accent rounded-full`} />
      )}
      {/* Active tab glow indicator */}
      {isActive && !vertical && (
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
      {isActive && vertical && (
        <>
          {/* Left accent line */}
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-transparent via-obsidian-accent to-transparent rounded-full" />
          {/* Right connection to content */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-obsidian-bg" />
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
