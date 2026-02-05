interface EmptyStateProps {
  onCreateSession: () => void
}

export function EmptyState({ onCreateSession }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      {/* Ambient glow effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-obsidian-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* Icon container with glow */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-obsidian-accent/20 rounded-2xl blur-xl" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-obsidian-float to-obsidian-surface border border-obsidian-border flex items-center justify-center">
            <svg
              className="w-10 h-10 text-obsidian-accent"
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
        </div>

        <h2 className="text-xl font-medium text-obsidian-text mb-2">
          No sessions open
        </h2>
        <p className="text-sm text-obsidian-text-muted mb-8 text-center max-w-xs">
          Start a new terminal session to begin tracking your changes
        </p>

        <button
          className="
            group relative px-6 py-3 bg-obsidian-accent text-obsidian-void font-medium rounded-xl
            transition-all duration-300 ease-out-expo
            hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]
            flex items-center gap-2.5
          "
          onClick={onCreateSession}
        >
          <svg
            className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Session
        </button>

        <div className="mt-6 flex items-center gap-2 text-xs text-obsidian-text-ghost">
          <span>or press</span>
          <kbd>Ctrl</kbd>
          <span>+</span>
          <kbd>T</kbd>
        </div>
      </div>
    </div>
  )
}
