import { useState } from 'react'
import logoPng from '../../../../resources/icon.png'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  uiScale: number
  onUiScaleChange: (scale: number) => void
  automationEnabled: boolean
  onAutomationToggle: (enabled: boolean) => Promise<void>
}

const SCALE_MIN = 0.75
const SCALE_MAX = 1.5
const SCALE_STEP = 0.05

const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')

export function SettingsModal({ isOpen, onClose, uiScale, onUiScaleChange, automationEnabled, onAutomationToggle }: SettingsModalProps) {
  const [confirmingApi, setConfirmingApi] = useState(false)
  const [apiToggling, setApiToggling] = useState(false)

  if (!isOpen) return null

  const percent = Math.round(uiScale * 100)
  const atMin = uiScale <= SCALE_MIN
  const atMax = uiScale >= SCALE_MAX

  const decrease = () => {
    if (!atMin) onUiScaleChange(Math.max(SCALE_MIN, Math.round((uiScale - SCALE_STEP) * 100) / 100))
  }

  const increase = () => {
    if (!atMax) onUiScaleChange(Math.min(SCALE_MAX, Math.round((uiScale + SCALE_STEP) * 100) / 100))
  }

  const reset = () => {
    onUiScaleChange(1.0)
  }

  const handleApiToggleClick = () => {
    if (automationEnabled) {
      // Disabling is safe, no confirmation needed
      setApiToggling(true)
      onAutomationToggle(false).finally(() => setApiToggling(false))
    } else {
      // Enabling needs confirmation
      setConfirmingApi(true)
    }
  }

  const handleApiConfirm = () => {
    setConfirmingApi(false)
    setApiToggling(true)
    onAutomationToggle(true).finally(() => setApiToggling(false))
  }

  const handleApiCancel = () => {
    setConfirmingApi(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop - no blur so scale changes are visible immediately */}
      <div className="absolute inset-0 bg-obsidian-void/40" />

      {/* Modal */}
      <div
        className="
          relative max-w-[700px] w-full mx-4 animate-slide-up
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
              <svg className="w-4 h-4 text-obsidian-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                <line x1="3" y1="8" x2="21" y2="8" />
                <line x1="3" y1="16" x2="21" y2="16" />
                <circle cx="9" cy="8" r="2.5" fill="currentColor" stroke="none" />
                <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-obsidian-text">
              Settings
            </h2>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-obsidian-text-muted hover:text-obsidian-text hover:bg-obsidian-float transition-all duration-200"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Two-column layout: About + Settings */}
        <div className="flex">

        {/* About column */}
        <div className="w-56 flex-shrink-0 px-5 py-6 border-r border-obsidian-border-subtle bg-obsidian-surface/50 flex flex-col items-center justify-center gap-5">
          <img src={logoPng} alt="" className="w-24 h-24 rounded-2xl" draggable={false} />
          <div className="text-center">
            <p className="text-base font-semibold text-obsidian-text whitespace-nowrap">Claude Did What?!</p>
            <p className="text-xs text-obsidian-text-secondary mt-1">AI slop by Andrew Orr</p>
          </div>
          <div className="flex flex-col items-center gap-2 mt-2">
            <svg className="w-6 h-6 text-obsidian-text-muted" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <p className="text-sm text-obsidian-text-secondary text-center">MIT licensed. PRs welcome.</p>
            <button
              className="text-[10px] text-obsidian-text-secondary hover:text-obsidian-accent transition-colors cursor-pointer"
              onClick={() => window.electronAPI.shell.openExternal('https://github.com/xorrbit/claudedidwhat/')}
            >
              https://github.com/xorrbit/claudedidwhat/
            </button>
          </div>
        </div>

        {/* Settings column */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {/* UI Scale */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-obsidian-text">UI Scale</span>
                <p className="text-xs text-obsidian-text-ghost mt-0.5">Adjust font size across the interface</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-obsidian-text-secondary hover:text-obsidian-text hover:bg-obsidian-float border border-obsidian-border-subtle transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none"
                  onClick={decrease}
                  disabled={atMin}
                  title="Decrease font size"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-12 text-center text-sm font-mono font-medium text-obsidian-text tabular-nums">
                  {percent}%
                </span>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-obsidian-text-secondary hover:text-obsidian-text hover:bg-obsidian-float border border-obsidian-border-subtle transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none"
                  onClick={increase}
                  disabled={atMax}
                  title="Increase font size"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reset link */}
            {percent !== 100 && (
              <div className="mt-3 flex justify-end">
                <button
                  className="text-xs text-obsidian-accent hover:text-obsidian-accent-dim transition-colors"
                  onClick={reset}
                >
                  Reset to 100%
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-obsidian-border-subtle" />

          {/* Automation API */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-obsidian-text">Automation API</span>
                <p className="text-xs text-obsidian-text-ghost mt-0.5">HTTP server for external tool integration</p>
              </div>
              <button
                className={`
                  relative w-10 h-[22px] rounded-full transition-colors duration-200
                  ${apiToggling ? 'opacity-50 pointer-events-none' : ''}
                  ${automationEnabled
                    ? 'bg-obsidian-accent'
                    : 'bg-obsidian-float border border-obsidian-border'
                  }
                `}
                onClick={handleApiToggleClick}
                disabled={apiToggling}
                title={automationEnabled ? 'Disable automation API' : 'Enable automation API'}
              >
                <span
                  className={`
                    absolute top-[3px] w-4 h-4 rounded-full transition-all duration-200
                    ${automationEnabled
                      ? 'left-[21px] bg-obsidian-void'
                      : 'left-[3px] bg-obsidian-text-ghost'
                    }
                  `}
                />
              </button>
            </div>

            {/* Confirmation warning */}
            {confirmingApi && (
              <div className="mt-3 p-3 rounded-lg bg-obsidian-modified/5 border border-obsidian-modified/20">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-obsidian-modified flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z" />
                  </svg>
                  <div>
                    <p className="text-xs text-obsidian-text-secondary leading-relaxed">
                      This starts a local HTTP server that allows external programs to open tabs and run commands. Only enable this if you understand the security implications.
                    </p>
                    <p className="text-xs text-obsidian-text-ghost mt-1.5">
                      Requires <span className="font-mono">allowedRoots</span> in the automation config.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        className="px-3 py-1.5 text-xs font-medium text-obsidian-modified bg-obsidian-modified/10 hover:bg-obsidian-modified/20 rounded-md border border-obsidian-modified/20 transition-colors"
                        onClick={handleApiConfirm}
                      >
                        Enable
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs font-medium text-obsidian-text-secondary hover:text-obsidian-text rounded-md hover:bg-obsidian-hover transition-colors"
                        onClick={handleApiCancel}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        </div>{/* end two-column layout */}

        {/* Footer */}
        <div className="px-6 py-4 bg-obsidian-surface/50 border-t border-obsidian-border-subtle">
          <p className="text-xs text-obsidian-text-ghost text-center flex items-center justify-center gap-2">
            Press <kbd className="text-2xs">Esc</kbd> to close
            <span className="text-obsidian-text-ghost/50">|</span>
            <kbd className="text-2xs">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <span className="text-obsidian-text-ghost text-2xs">+</span>
            <kbd className="text-2xs">,</kbd> to toggle
          </p>
        </div>
      </div>
    </div>
  )
}
