import { useEffect, useCallback, useRef } from 'react'

interface KeyboardShortcutsOptions {
  onNewTab: () => void
  onCloseTab: () => void
  onNextTab: () => void
  onPrevTab: () => void
  onGoToTab: (index: number) => void
  onShowHelp?: () => void
  onTabSwitched?: () => void
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
  // Track if we need to call onTabSwitched after Tab key is released
  const pendingTabFocusRef = useRef(false)

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
        if (e.shiftKey) {
          onPrevTab()
        } else {
          onNextTab()
        }
        // Mark that we need to focus after Tab is released
        pendingTabFocusRef.current = true
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
    [onNewTab, onCloseTab, onNextTab, onPrevTab, onGoToTab, onShowHelp]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      // When Tab key is released and we have a pending focus, trigger it
      if (e.key === 'Tab' && pendingTabFocusRef.current) {
        pendingTabFocusRef.current = false
        e.preventDefault()
        e.stopPropagation()
        onTabSwitched?.()
      }
    },
    [onTabSwitched]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])
}
