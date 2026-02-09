import { useState, useEffect, useCallback, useRef } from 'react'
import { ChangedFile, DiffContent } from '@shared/types'
import { subscribeFileChanged } from '../lib/eventDispatchers'

interface UseGitDiffOptions {
  sessionId: string
  cwd: string
  enabled?: boolean
  gitRootHint?: string | null
}

interface UseGitDiffReturn {
  files: ChangedFile[]
  selectedFile: string | null
  diffContent: DiffContent | null
  isLoading: boolean
  isDiffLoading: boolean
  error: string | null
  gitRoot: string | null
  selectFile: (path: string) => void
  refresh: () => void
}

const MAX_CACHE_SIZE = 50
const REACTIVATION_REFRESH_DELAY_MS = 50
const MIN_REACTIVATION_REFRESH_INTERVAL_MS = 2000
const DIFF_FETCH_DEFER_MS = 0

export function useGitDiff({ sessionId, cwd, enabled = true, gitRootHint }: UseGitDiffOptions): UseGitDiffReturn {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<DiffContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gitRoot, setGitRoot] = useState<string | null>(null)
  const selectedFileRef = useRef<string | null>(null)
  const prevGitRootRef = useRef<string | null>(null)
  const initialLoadDone = useRef(false)
  const wasEnabledRef = useRef(enabled)
  const lastSuccessfulLoadAtRef = useRef(0)
  const loadRequestId = useRef(0)
  const loadFilesRef = useRef<(() => Promise<void>) | null>(null)
  // Track enabled in a ref so watcher callbacks can check it without
  // the watcher effect needing `enabled` in its dependency array.
  const enabledRef = useRef(enabled)
  useEffect(() => { enabledRef.current = enabled }, [enabled])
  // LRU cache: Map maintains insertion order, so we delete+re-add on access
  const diffCache = useRef<Map<string, DiffContent>>(new Map())

  // Set cache entry with LRU eviction
  const setCacheEntry = useCallback((key: string, value: DiffContent) => {
    const cache = diffCache.current
    // Delete first to update insertion order (makes it most recent)
    cache.delete(key)
    cache.set(key, value)
    // Evict oldest entries if over limit
    while (cache.size > MAX_CACHE_SIZE) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) {
        cache.delete(oldest)
      }
    }
  }, [])

  // Get cache entry and mark as recently used
  const getCacheEntry = useCallback((key: string): DiffContent | undefined => {
    const cache = diffCache.current
    const value = cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      cache.delete(key)
      cache.set(key, value)
    }
    return value
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    selectedFileRef.current = selectedFile
  }, [selectedFile])

  // Resolve git root whenever cwd changes. Use context hint when available
  // to skip the IPC round trip.
  useEffect(() => {
    if (!enabled) return

    if (gitRootHint !== undefined) {
      setGitRoot(gitRootHint)
      return
    }

    let cancelled = false
    window.electronAPI.git.findGitRoot(cwd).then((root) => {
      if (!cancelled) {
        setGitRoot(root)
      }
    })
    return () => { cancelled = true }
  }, [cwd, enabled, gitRootHint])

  // Load changed files and refresh diff if a file is selected
  const loadFiles = useCallback(async () => {
    if (!gitRoot) {
      setFiles([])
      setError(null)
      setIsLoading(false)
      return
    }

    const requestId = ++loadRequestId.current

    try {
      const changedFiles = await window.electronAPI.git.getChangedFiles(gitRoot)

      // Bail if a newer request has been issued
      if (requestId !== loadRequestId.current) return

      setFiles((prev) => {
        if (
          prev.length === changedFiles.length &&
          prev.every((f, i) => f.path === changedFiles[i].path && f.status === changedFiles[i].status)
        ) {
          return prev
        }
        return changedFiles
      })
      setError(null)
      lastSuccessfulLoadAtRef.current = Date.now()

      // Auto-select first file if none selected (use ref to avoid dependency)
      if (!selectedFileRef.current && changedFiles.length > 0) {
        const firstPath = changedFiles[0].path
        setSelectedFile(firstPath)
      } else if (selectedFileRef.current) {
        const selectedPath = selectedFileRef.current
        const selectedStillChanged = changedFiles.some((file) => file.path === selectedPath)

        if (!selectedStillChanged) {
          // Selected file is no longer changed; switch to first changed file (if any)
          // and avoid re-fetching a stale diff.
          const nextSelected = changedFiles[0]?.path ?? null
          selectedFileRef.current = nextSelected
          setSelectedFile(nextSelected)
          if (!nextSelected) {
            setDiffContent(null)
          }
          diffCache.current.delete(selectedPath)
          return
        }

        // Skip expensive diff refresh for background tabs
        if (!enabledRef.current) return

        // Refresh diff content for currently selected file
        try {
          const diff = await window.electronAPI.git.getFileDiff(gitRoot, selectedPath)

          if (requestId !== loadRequestId.current) return

          // Read directly without updating LRU (this is a background refresh)
          const cached = diffCache.current.get(selectedPath)

          // Only update if diff actually changed
          const hasChanged = !cached ||
            cached.original !== diff?.original ||
            cached.modified !== diff?.modified

          if (hasChanged) {
            setDiffContent(diff)
            if (diff) {
              setCacheEntry(selectedPath, diff)
            } else {
              diffCache.current.delete(selectedPath)
            }
          }
        } catch {
          // Ignore diff refresh errors
        }
      }
    } catch (err) {
      if (requestId !== loadRequestId.current) return
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      if (requestId === loadRequestId.current) {
        setIsLoading(false)
      }
    }
  }, [gitRoot, setCacheEntry])

  // Keep ref in sync so mount timeout always calls latest version
  loadFilesRef.current = loadFiles

  // Delay initial load to not block terminal initialization
  useEffect(() => {
    if (!enabled || initialLoadDone.current) return

    const timer = setTimeout(() => {
      loadFilesRef.current?.()
      initialLoadDone.current = true
    }, 500) // Wait 500ms after mount before first git check

    return () => clearTimeout(timer)
  }, [enabled])

  // When reactivating an already-initialized tab, refresh after a short debounce
  // so rapid tab switches don't fire intermediate requests.
  useEffect(() => {
    const wasEnabled = wasEnabledRef.current
    wasEnabledRef.current = enabled

    if (enabled && !wasEnabled && initialLoadDone.current) {
      const recentlyLoaded =
        Date.now() - lastSuccessfulLoadAtRef.current < MIN_REACTIVATION_REFRESH_INTERVAL_MS
      if (recentlyLoaded) return

      const timer = setTimeout(() => {
        loadFilesRef.current?.()
      }, REACTIVATION_REFRESH_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [enabled])

  // React to git root changes (after initial load)
  useEffect(() => {
    if (!enabled) return

    if (!initialLoadDone.current) return

    if (prevGitRootRef.current !== gitRoot) {
      const hadPreviousRoot = prevGitRootRef.current !== null
      prevGitRootRef.current = gitRoot

      if (hadPreviousRoot) {
        // Different git root — clear selection and cache
        setSelectedFile(null)
        selectedFileRef.current = null
        setDiffContent(null)
        diffCache.current.clear()
        setIsLoading(true)
      }

      // Always refresh files (same root = background refresh, different root = full reload)
      loadFiles()
    }
  }, [enabled, gitRoot, loadFiles])

  // Load diff when selected file changes (with small delay)
  useEffect(() => {
    if (!enabled) {
      setIsDiffLoading(false)
      return
    }

    if (!selectedFile) {
      setDiffContent(null)
      setIsDiffLoading(false)
      return
    }

    // Capture file path to avoid stale closure issues
    const filePath = selectedFile

    // Check cache — if selectFile() already set this content, skip the redundant setState.
    // Read without LRU mutation since selectFile() already updated LRU order.
    const cached = diffCache.current.get(filePath)
    if (cached) {
      return
    }

    let cancelled = false
    let deferTimer: ReturnType<typeof setTimeout> | null = null
    setIsDiffLoading(true)
    setDiffContent(null)

    const loadDiff = async () => {
      const dir = gitRoot || cwd
      try {
        const diff = await window.electronAPI.git.getFileDiff(dir, filePath)
        if (!cancelled) {
          setDiffContent(diff)
          // Store in cache using captured filePath
          if (diff) {
            setCacheEntry(filePath, diff)
          }
        }
      } catch (err) {
        console.error('Failed to load diff:', err)
        if (!cancelled) {
          setDiffContent(null)
        }
      } finally {
        if (!cancelled) {
          setIsDiffLoading(false)
        }
      }
    }

    deferTimer = setTimeout(() => {
      void loadDiff()
    }, DIFF_FETCH_DEFER_MS)

    return () => {
      cancelled = true
      if (deferTimer) clearTimeout(deferTimer)
      setIsDiffLoading(false)
    }
  }, [enabled, gitRoot, cwd, selectedFile, setCacheEntry])

  // Watch for file changes and refresh git status reactively.
  // Lifecycle is tied to sessionId + gitRoot only — NOT to `enabled`.
  // This avoids tearing down and rebuilding the watcher on every tab switch,
  // which was the main source of lag during rapid switching.
  useEffect(() => {
    if (!gitRoot) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let isRefreshing = false
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const debouncedRefresh = () => {
      // Skip refresh if window hidden, already refreshing, or tab inactive
      if (document.hidden || isRefreshing || !enabledRef.current) return

      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      // Debounce rapid file changes (e.g., save + format)
      debounceTimer = setTimeout(async () => {
        isRefreshing = true
        try {
          await loadFilesRef.current?.()
        } finally {
          isRefreshing = false
        }
      }, 300)
    }

    const startWatching = async () => {
      let hasNativeWatcher = false
      try {
        hasNativeWatcher = await window.electronAPI.fs.watchStart(sessionId, gitRoot)
      } catch {
        hasNativeWatcher = false
      }

      if (cancelled || hasNativeWatcher) return

      // Fallback poll every 5s only when native watcher is unavailable
      // (on WSL2 this becomes the primary refresh mechanism)
      fallbackInterval = setInterval(() => {
        if (!document.hidden && !isRefreshing && enabledRef.current) {
          loadFilesRef.current?.()
        }
      }, 5000)
    }

    const unsubscribe = subscribeFileChanged(sessionId, () => {
      debouncedRefresh()
    })
    void startWatching()

    // Refresh when tab becomes visible (and this tab is active)
    const handleVisibilityChange = () => {
      if (!document.hidden && enabledRef.current) {
        debouncedRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      if (fallbackInterval) clearInterval(fallbackInterval)
      unsubscribe()
      window.electronAPI.fs.watchStop(sessionId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessionId, gitRoot])

  const selectFile = useCallback((path: string) => {
    // Check cache first for instant switching (also marks as recently used)
    const cached = getCacheEntry(path)
    if (cached) {
      // Update both states together to avoid intermediate render with stale content
      setSelectedFile(path)
      setDiffContent(cached)
      setIsDiffLoading(false)
    } else {
      setSelectedFile(path)
    }
  }, [getCacheEntry])

  const refresh = useCallback(() => {
    diffCache.current.clear()
    setIsLoading(true)
    loadFiles()
  }, [loadFiles])

  return {
    files,
    selectedFile,
    diffContent,
    isLoading,
    isDiffLoading,
    error,
    gitRoot,
    selectFile,
    refresh,
  }
}
