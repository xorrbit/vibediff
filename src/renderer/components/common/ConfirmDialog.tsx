interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Close anyway',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={onCancel}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-obsidian-void/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="
          relative max-w-sm w-full mx-4 animate-slide-up
          bg-gradient-to-b from-obsidian-elevated to-obsidian-surface
          border border-obsidian-border rounded-2xl
          shadow-float overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-obsidian-modified/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-obsidian-border-subtle">
          <div className="w-8 h-8 rounded-lg bg-obsidian-modified/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-obsidian-modified" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-obsidian-text">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-obsidian-text-secondary leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-obsidian-surface/50 border-t border-obsidian-border-subtle">
          <button
            className="px-4 py-2 text-sm font-medium text-obsidian-text-secondary hover:text-obsidian-text rounded-lg hover:bg-obsidian-hover transition-colors"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-obsidian-deleted bg-obsidian-deleted/10 hover:bg-obsidian-deleted/20 rounded-lg border border-obsidian-deleted/20 transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
