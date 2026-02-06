import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGitDiff } from '@renderer/hooks/useGitDiff'
import type { ChangedFile, DiffContent } from '@shared/types'

// Extend the mock electronAPI for this test
const mockGit = {
  getChangedFiles: vi.fn(),
  getFileDiff: vi.fn(),
  getFileContent: vi.fn(),
  getMainBranch: vi.fn(),
  getCurrentBranch: vi.fn(),
  findGitRoot: vi.fn(),
}

const mockFs = {
  watchStart: vi.fn(),
  watchStop: vi.fn(),
  onFileChanged: vi.fn(() => () => {}),
  selectDirectory: vi.fn(),
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
  onFileChange: vi.fn(() => () => {}),
  getHomeDir: vi.fn(),
}

describe('useGitDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Setup default mocks
    Object.assign(window.electronAPI.git, mockGit)
    Object.assign(window.electronAPI.fs, mockFs)

    mockGit.getChangedFiles.mockResolvedValue([])
    mockGit.getFileDiff.mockResolvedValue(null)
    mockGit.findGitRoot.mockResolvedValue('/test/dir')
    mockFs.watchStart.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial loading', () => {
    it('starts with loading state', () => {
      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.files).toEqual([])
    })

    it('delays initial load by 2 seconds', async () => {
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Should not have called yet
      expect(mockGit.getChangedFiles).not.toHaveBeenCalled()

      // Advance by 2 seconds and flush promises
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(mockGit.getChangedFiles).toHaveBeenCalledWith('/test/dir')
    })

    it('auto-selects first file when files are loaded', async () => {
      const files: ChangedFile[] = [
        { path: 'first.ts', status: 'M' },
        { path: 'second.ts', status: 'A' },
      ]
      mockGit.getChangedFiles.mockResolvedValue(files)

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(result.current.selectedFile).toBe('first.ts')
    })
  })

  describe('file selection', () => {
    it('loads diff when file is selected', async () => {
      const diff: DiffContent = { original: 'old', modified: 'new' }
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])
      mockGit.getFileDiff.mockResolvedValue(diff)

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Wait for diff load (100ms delay + promise resolution)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.diffContent).toEqual(diff)
    })

    it('shows isDiffLoading while loading diff', async () => {
      mockGit.getChangedFiles.mockResolvedValue([])
      // Simulate a slow diff load
      mockGit.getFileDiff.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ original: '', modified: '' }), 500))
      )

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      act(() => {
        result.current.selectFile('test.ts')
      })

      // After the 100ms delay before loading starts
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.isDiffLoading).toBe(true)

      // After the diff resolves
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      expect(result.current.isDiffLoading).toBe(false)
    })
  })

  describe('LRU cache', () => {
    it('returns cached diff instantly without API call', async () => {
      const diff1: DiffContent = { original: 'old1', modified: 'new1' }
      const diff2: DiffContent = { original: 'old2', modified: 'new2' }

      mockGit.getChangedFiles.mockResolvedValue([
        { path: 'file1.ts', status: 'M' },
        { path: 'file2.ts', status: 'M' },
      ])
      mockGit.getFileDiff
        .mockResolvedValueOnce(diff1)
        .mockResolvedValueOnce(diff2)
        .mockResolvedValueOnce(diff1)

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial load (file1 is auto-selected)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Wait for first file's diff
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.diffContent).toEqual(diff1)
      expect(mockGit.getFileDiff).toHaveBeenCalledTimes(1)

      // Select second file
      act(() => {
        result.current.selectFile('file2.ts')
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.diffContent).toEqual(diff2)
      expect(mockGit.getFileDiff).toHaveBeenCalledTimes(2)

      // Go back to first file - should be instant from cache
      act(() => {
        result.current.selectFile('file1.ts')
      })

      // Cache hit - immediate, no timer wait needed
      expect(result.current.diffContent).toEqual(diff1)
      expect(result.current.isDiffLoading).toBe(false)
      // Should NOT have made another API call
      expect(mockGit.getFileDiff).toHaveBeenCalledTimes(2)
    })

    it('updates LRU order when accessing cached item', async () => {
      const files: ChangedFile[] = [
        { path: 'file1.ts', status: 'M' },
        { path: 'file2.ts', status: 'M' },
        { path: 'file3.ts', status: 'M' },
      ]

      mockGit.getChangedFiles.mockResolvedValue(files)
      mockGit.getFileDiff.mockImplementation((_, path) =>
        Promise.resolve({ original: `old-${path}`, modified: `new-${path}` })
      )

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Load all 3 files
      for (const file of files) {
        act(() => {
          result.current.selectFile(file.path)
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100)
        })
      }

      const callsAfterLoading = mockGit.getFileDiff.mock.calls.length

      // Access file1 again - should not cause API call
      act(() => {
        result.current.selectFile('file1.ts')
      })

      expect(mockGit.getFileDiff.mock.calls.length).toBe(callsAfterLoading)
    })
  })

  describe('cwd change', () => {
    it('reloads files from new git root when root changes', async () => {
      // Start with /dir1 git root
      mockGit.findGitRoot.mockResolvedValue('/dir1')
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'old-file.ts', status: 'M' }])
      mockGit.getFileDiff.mockResolvedValue({ original: 'old', modified: 'new' })

      const { result, rerender } = renderHook(
        ({ cwd }) => useGitDiff({ sessionId: 'test-session', cwd }),
        { initialProps: { cwd: '/dir1' } }
      )

      // Let findGitRoot resolve and initial load complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100)
      })

      expect(result.current.selectedFile).toBe('old-file.ts')
      expect(mockGit.getChangedFiles).toHaveBeenCalledWith('/dir1')

      // Now change to different git root with different files
      mockGit.findGitRoot.mockResolvedValue('/dir2')
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'new-file.ts', status: 'A' }])

      // Change cwd
      rerender({ cwd: '/dir2' })

      // Flush findGitRoot promise + effects + loadFiles
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Should have fetched files from the new git root
      expect(mockGit.getChangedFiles).toHaveBeenCalledWith('/dir2')
      // Should show files from new root (cache was cleared, new files loaded)
      expect(result.current.files).toEqual([{ path: 'new-file.ts', status: 'A' }])
      // Auto-selected first file from new root
      expect(result.current.selectedFile).toBe('new-file.ts')
    })

    it('does NOT clear cache/selection when cd within same git root', async () => {
      // Same git root for both /repo/src and /repo/lib
      mockGit.findGitRoot.mockResolvedValue('/repo')
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])
      mockGit.getFileDiff.mockResolvedValue({ original: 'old', modified: 'new' })

      const { result, rerender } = renderHook(
        ({ cwd }) => useGitDiff({ sessionId: 'test-session', cwd }),
        { initialProps: { cwd: '/repo/src' } }
      )

      // Let findGitRoot resolve and initial load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100)
      })

      expect(result.current.selectedFile).toBe('file.ts')

      // cd to different subdir in same repo
      rerender({ cwd: '/repo/lib' })

      // Let findGitRoot resolve for new cwd (same root)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      // Selection should be preserved (same git root)
      expect(result.current.selectedFile).toBe('file.ts')
    })
  })

  describe('refresh', () => {
    it('clears cache and reloads files', async () => {
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])
      mockGit.getFileDiff.mockResolvedValue({ original: 'old', modified: 'new' })

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(result.current.isLoading).toBe(false)

      const callsBefore = mockGit.getChangedFiles.mock.calls.length

      act(() => {
        result.current.refresh()
      })

      expect(result.current.isLoading).toBe(true)
      expect(mockGit.getChangedFiles.mock.calls.length).toBe(callsBefore + 1)
    })

    it('does not refetch diff when selected file is no longer in changed files', async () => {
      mockGit.getChangedFiles.mockResolvedValueOnce([{ path: 'file.ts', status: 'M' }])
      mockGit.getChangedFiles.mockResolvedValueOnce([])
      mockGit.getFileDiff.mockResolvedValue({ original: 'old', modified: 'new' })

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial file load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Initial selected-file diff load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      const diffCallsAfterInitialLoad = mockGit.getFileDiff.mock.calls.length

      act(() => {
        result.current.refresh()
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current.selectedFile).toBeNull()
      expect(result.current.diffContent).toBeNull()
      expect(mockGit.getFileDiff.mock.calls.length).toBe(diffCallsAfterInitialLoad)
    })
  })

  describe('error handling', () => {
    it('sets error state when getChangedFiles fails', async () => {
      mockGit.getChangedFiles.mockRejectedValue(new Error('Git error'))

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(result.current.error).toBe('Git error')
      expect(result.current.files).toEqual([])
    })

    it('handles diff load failure gracefully', async () => {
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])
      mockGit.getFileDiff.mockRejectedValue(new Error('Diff error'))

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.diffContent).toBeNull()
      expect(result.current.isDiffLoading).toBe(false)
    })
  })

  describe('file watcher', () => {
    it('starts file watcher with git root on mount', async () => {
      mockGit.findGitRoot.mockResolvedValue('/git/root')

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/git/root/src' })
      )

      // Let findGitRoot resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(mockFs.watchStart).toHaveBeenCalledWith('test-session', '/git/root')
    })

    it('does not start fallback polling when native watcher is active', async () => {
      mockFs.watchStart.mockResolvedValue(true)
      mockGit.getChangedFiles.mockResolvedValue([])

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial delayed load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      const callsAfterInit = mockGit.getChangedFiles.mock.calls.length

      // No 5s fallback polling when native watcher is active
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(mockGit.getChangedFiles.mock.calls.length).toBe(callsAfterInit)
    })

    it('starts fallback polling when native watcher is unavailable', async () => {
      mockFs.watchStart.mockResolvedValue(false)
      mockGit.getChangedFiles.mockResolvedValue([])

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial delayed load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      const callsAfterInit = mockGit.getChangedFiles.mock.calls.length

      // Fallback poll should trigger after 5s
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(mockGit.getChangedFiles.mock.calls.length).toBe(callsAfterInit + 1)
    })

    it('does not start file watcher when not in git repo', async () => {
      mockGit.findGitRoot.mockResolvedValue(null)

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/not-a-repo' })
      )

      // Let findGitRoot resolve — watcher initially uses cwd since gitRoot is null
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(mockFs.watchStart).not.toHaveBeenCalled()
      expect(mockFs.onFileChanged).not.toHaveBeenCalled()
    })

    it('stops file watcher on unmount', async () => {
      mockGit.findGitRoot.mockResolvedValue('/git/root')

      const { unmount } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      unmount()

      expect(mockFs.watchStop).toHaveBeenCalledWith('test-session')
    })
  })

  describe('debouncing', () => {
    it('debounces file change events', async () => {
      let fileChangeHandler: ((event: { sessionId: string }) => void) | null = null
      mockFs.onFileChanged.mockImplementation((handler) => {
        fileChangeHandler = handler
        return () => {}
      })

      mockGit.getChangedFiles.mockResolvedValue([])

      renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/test/dir' })
      )

      // Initial load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      const callsAfterInit = mockGit.getChangedFiles.mock.calls.length

      // Simulate rapid file changes
      act(() => {
        fileChangeHandler?.({ sessionId: 'test-session' })
        fileChangeHandler?.({ sessionId: 'test-session' })
        fileChangeHandler?.({ sessionId: 'test-session' })
      })

      // Before debounce completes - should not have called yet
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(mockGit.getChangedFiles.mock.calls.length).toBe(callsAfterInit)

      // After debounce (500ms total)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })

      // Should have made exactly one call after debounce
      expect(mockGit.getChangedFiles.mock.calls.length).toBe(callsAfterInit + 1)
    })
  })

  describe('non-git directory', () => {
    it('clears files when findGitRoot returns null', async () => {
      mockGit.findGitRoot.mockResolvedValue(null)
      mockGit.getChangedFiles.mockResolvedValue([{ path: 'file.ts', status: 'M' }])

      const { result } = renderHook(() =>
        useGitDiff({ sessionId: 'test-session', cwd: '/not-a-repo' })
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      // Should not call getChangedFiles when not in a git repo
      expect(result.current.files).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })
  })
})
