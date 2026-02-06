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
  const [gitRoot, setGitRoot] = useState<string | null>(null)
  const selectedFileRef = useRef<string | null>(null)
  const prevGitRootRef = useRef<string | null>(null)
  const initialLoadDone = useRef(false)
  const loadRequestId = useRef(0)
  const loadFilesRef = useRef<() => Promise<void>>()
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

  // Resolve git root whenever cwd changes
  useEffect(() => {
    let cancelled = false
    window.electronAPI.git.findGitRoot(cwd).then((root) => {
      if (!cancelled) {
        setGitRoot(root)
      }
    })
    return () => { cancelled = true }
  }, [cwd])

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

      setFiles(changedFiles)
      setError(null)

      // Auto-select first file if none selected (use ref to avoid dependency)
      if (!selectedFileRef.current && changedFiles.length > 0) {
        setSelectedFile(changedFiles[0].path)
      } else if (selectedFileRef.current) {
        // Refresh diff content for currently selected file
        try {
          const diff = await window.electronAPI.git.getFileDiff(gitRoot, selectedFileRef.current)

          if (requestId !== loadRequestId.current) return

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
    const timer = setTimeout(() => {
      loadFilesRef.current?.()
      initialLoadDone.current = true
    }, 2000) // Wait 2 seconds after mount before first git check

    return () => clearTimeout(timer)
  }, []) // Only run on mount

  // React to git root changes (after initial load)
  useEffect(() => {
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
  }, [gitRoot, loadFiles])

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

    const timer = setTimeout(loadDiff, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setIsDiffLoading(false)
    }
  }, [gitRoot, cwd, selectedFile, getCacheEntry, setCacheEntry])

  // Watch for file changes and refresh git status reactively
  // Depends on gitRoot so cd'ing within a repo does NOT restart the watcher
  useEffect(() => {
    const watchDir = gitRoot || cwd
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
    window.electronAPI.fs.watchStart(sessionId, watchDir)
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
  }, [sessionId, gitRoot, cwd, loadFiles])

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
