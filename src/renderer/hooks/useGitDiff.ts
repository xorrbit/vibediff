import { useState, useEffect, useCallback, useRef } from 'react'
import { ChangedFile, DiffContent } from '@shared/types'

interface UseGitDiffOptions {
  sessionId: string
  cwd: string
}

interface UseGitDiffReturn {
  files: ChangedFile[]
  selectedFile: string | null
  diffContent: DiffContent | null
  isLoading: boolean
  isDiffLoading: boolean
  error: string | null
  selectFile: (path: string) => void
  refresh: () => void
}

const MAX_CACHE_SIZE = 20

export function useGitDiff({ sessionId, cwd }: UseGitDiffOptions): UseGitDiffReturn {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<DiffContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedFileRef = useRef<string | null>(null)
  const prevCwdRef = useRef<string>(cwd)
  const initialLoadDone = useRef(false)
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

  // Load changed files and refresh diff if a file is selected
  const loadFiles = useCallback(async () => {
    try {
      const changedFiles = await window.electronAPI.git.getChangedFiles(cwd)
      setFiles(changedFiles)
      setError(null)

      // Auto-select first file if none selected (use ref to avoid dependency)
      if (!selectedFileRef.current && changedFiles.length > 0) {
        setSelectedFile(changedFiles[0].path)
      } else if (selectedFileRef.current) {
        // Refresh diff content for currently selected file
        try {
          const diff = await window.electronAPI.git.getFileDiff(cwd, selectedFileRef.current)
          // Read directly without updating LRU (this is a background refresh)
          const cached = diffCache.current.get(selectedFileRef.current)

          // Only update if diff actually changed
          const hasChanged = !cached ||
            cached.original !== diff?.original ||
            cached.modified !== diff?.modified

          if (hasChanged) {
            setDiffContent(diff)
            if (diff) {
              setCacheEntry(selectedFileRef.current, diff)
            } else {
              diffCache.current.delete(selectedFileRef.current)
            }
          }
        } catch {
          // Ignore diff refresh errors
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [cwd, setCacheEntry])

  // Delay initial load to not block terminal initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles()
      initialLoadDone.current = true
    }, 2000) // Wait 2 seconds after mount before first git check

    return () => clearTimeout(timer)
  }, []) // Only run on mount

  // Refresh immediately when cwd changes (after initial load)
  useEffect(() => {
    if (prevCwdRef.current !== cwd) {
      prevCwdRef.current = cwd

      if (initialLoadDone.current) {
        // Clear selection and cache for new directory
        setSelectedFile(null)
        selectedFileRef.current = null
        setDiffContent(null)
        diffCache.current.clear()
        setIsLoading(true)
        loadFiles()
      }
    }
  }, [cwd, loadFiles])

  // Load diff when selected file changes (with small delay)
  useEffect(() => {
    if (!selectedFile) {
      setDiffContent(null)
      setIsDiffLoading(false)
      return
    }

    // Capture file path to avoid stale closure issues
    const filePath = selectedFile

    // Check cache first (also marks as recently used)
    const cached = getCacheEntry(filePath)
    if (cached) {
      setDiffContent(cached)
      setIsDiffLoading(false)
      return
    }

    let cancelled = false
    setIsDiffLoading(true)
    setDiffContent(null)

    const loadDiff = async () => {
      try {
        const diff = await window.electronAPI.git.getFileDiff(cwd, filePath)
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

    const timer = setTimeout(loadDiff, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setIsDiffLoading(false)
    }
  }, [cwd, selectedFile, getCacheEntry, setCacheEntry])

  // Watch for file changes and refresh git status reactively
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let isRefreshing = false
    let fallbackInterval: ReturnType<typeof setInterval> | null = null

    const debouncedRefresh = () => {
      // Don't refresh if hidden or already refreshing
      if (document.hidden || isRefreshing) return

      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      // Debounce rapid file changes (e.g., save + format)
      debounceTimer = setTimeout(async () => {
        isRefreshing = true
        try {
          await loadFiles()
        } finally {
          isRefreshing = false
        }
      }, 500)
    }

    // Start file watcher
    window.electronAPI.fs.watchStart(sessionId, cwd)
    const unsubscribe = window.electronAPI.fs.onFileChanged((event) => {
      if (event.sessionId === sessionId) {
        debouncedRefresh()
      }
    })

    // Fallback poll every 5s in case watcher misses something
    // (on WSL2 the file watcher is disabled, so this is the primary refresh)
    fallbackInterval = setInterval(() => {
      if (!document.hidden && !isRefreshing) {
        loadFiles()
      }
    }, 5000)

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (fallbackInterval) clearInterval(fallbackInterval)
      unsubscribe()
      window.electronAPI.fs.watchStop(sessionId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessionId, cwd, loadFiles])

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
    selectFile,
    refresh,
  }
}
