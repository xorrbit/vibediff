interface HelpOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: ['Ctrl', 'T'], description: 'New tab' },
  { keys: ['Ctrl', 'W'], description: 'Close tab' },
  { keys: ['Ctrl', 'Tab'], description: 'Next tab' },
  { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Previous tab' },
  { keys: ['Ctrl', '1-9'], description: 'Go to tab' },
  { keys: ['Ctrl', '?'], description: 'Show this help' },
  { keys: ['Ctrl', ','], description: 'Settings' },
]

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')

function formatKey(key: string): string {
  if (key === 'Ctrl' && isMac) return '⌘'
  if (key === 'Shift') return isMac ? '⇧' : 'Shift'
  if (key === 'Tab') return '⇥'
  return key
}

export function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-obsidian-void/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="
          relative max-w-md w-full mx-4 animate-slide-up
          bg-gradient-to-b from-obsidian-elevated to-obsidian-surface
          border border-obsidian-border rounded-2xl
          shadow-float overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-obsidian-accent/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-obsidian-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-obsidian-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-obsidian-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-obsidian-text">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-obsidian-text-muted hover:text-obsidian-text hover:bg-obsidian-float transition-all duration-200"
            onClick={onClose}
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-6 py-4">
          <div className="space-y-1">
            {shortcuts.map(({ keys, description }, index) => (
              <div
                key={description}
                className="flex items-center justify-between py-3 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-sm text-obsidian-text-secondary group-hover:text-obsidian-text transition-colors">
                  {description}
                </span>
                <div className="flex items-center gap-1">
                  {keys.map((key, i) => (
                    <span key={i} className="flex items-center">
                      <kbd className="group-hover:border-obsidian-accent/30 transition-colors">
                        {formatKey(key)}
                      </kbd>
                      {i < keys.length - 1 && (
                        <span className="text-obsidian-text-ghost mx-1 text-xs">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-obsidian-surface/50 border-t border-obsidian-border-subtle">
          <p className="text-xs text-obsidian-text-ghost text-center flex items-center justify-center gap-2">
            Press <kbd className="text-2xs">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
