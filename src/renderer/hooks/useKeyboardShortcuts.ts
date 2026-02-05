import { useEffect, useCallback } from 'react'

interface KeyboardShortcutsOptions {
  onNewTab: () => void
  onCloseTab: () => void
  onNextTab: () => string | undefined  // Returns new session ID
  onPrevTab: () => string | undefined  // Returns new session ID
  onGoToTab: (index: number) => void
  onShowHelp?: () => void
  onTabSwitched?: (sessionId: string) => void
}

export function useKeyboardShortcuts({
  onNewTab,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onGoToTab,
  onShowHelp,
  onTabSwitched,
}: KeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + T: New tab
      if (isMod && e.key === 't') {
        e.preventDefault()
        onNewTab()
        return
      }

      // Cmd/Ctrl + W: Close tab
      if (isMod && e.key === 'w') {
        e.preventDefault()
        onCloseTab()
        return
      }

      // Cmd/Ctrl + Tab: Next tab
      // Cmd/Ctrl + Shift + Tab: Previous tab
      if (isMod && e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const newSessionId = e.shiftKey ? onPrevTab() : onNextTab()
        // Use double rAF to wait for Tab key event to fully complete
        if (onTabSwitched && newSessionId) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onTabSwitched(newSessionId)
            })
          })
        }
        return
      }

      // Cmd/Ctrl + 1-9: Go to tab
      if (isMod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        onGoToTab(parseInt(e.key) - 1)
        return
      }

      // Cmd/Ctrl + ?: Show help
      if (isMod && e.key === '?' && onShowHelp) {
        e.preventDefault()
        onShowHelp()
        return
      }
    },
    [onNewTab, onCloseTab, onNextTab, onPrevTab, onGoToTab, onShowHelp, onTabSwitched]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
