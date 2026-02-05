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

export function useGitDiff({ cwd }: UseGitDiffOptions): UseGitDiffReturn {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<DiffContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedFileRef = useRef<string | null>(null)
  const prevCwdRef = useRef<string>(cwd)
  const initialLoadDone = useRef(false)
  const diffCache = useRef<Map<string, DiffContent>>(new Map())

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
          const cached = diffCache.current.get(selectedFileRef.current)

          // Only update if diff actually changed
          const hasChanged = !cached ||
            cached.original !== diff?.original ||
            cached.modified !== diff?.modified

          if (hasChanged) {
            setDiffContent(diff)
            if (diff) {
              diffCache.current.set(selectedFileRef.current, diff)
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
  }, [cwd])

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

    // Check cache first
    const cached = diffCache.current.get(filePath)
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
            diffCache.current.set(filePath, diff)
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
  }, [cwd, selectedFile])

  // Poll for file changes every 5 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadFiles()
    }, 5000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [loadFiles])

  const selectFile = useCallback((path: string) => {
    setSelectedFile(path)
  }, [])

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
