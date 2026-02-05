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
        // Focus terminal after a delay to let Tab key processing complete
        // Use longer delay on Linux where Tab key can interfere with focus
        if (onTabSwitched && newSessionId) {
          setTimeout(() => {
            onTabSwitched(newSessionId)
            // Try again in case something stole focus
            setTimeout(() => {
              onTabSwitched(newSessionId)
            }, 50)
          }, 150)
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
    // Use capture phase to catch events before other handlers
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])
}
