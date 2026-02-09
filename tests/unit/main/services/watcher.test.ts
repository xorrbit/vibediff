import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFsWatch, mockPlatform, mockReadFileSync } = vi.hoisted(() => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  }
  return {
    mockFsWatch: vi.fn(() => mockWatcher),
    mockPlatform: vi.fn(),
    mockReadFileSync: vi.fn(),
  }
})

vi.mock('fs', () => {
  const mod = { watch: mockFsWatch, readFileSync: mockReadFileSync }
  return { ...mod, default: mod }
})

vi.mock('os', () => {
  const mod = { platform: mockPlatform }
  return { ...mod, default: mod }
})

// Default: not WSL
mockPlatform.mockReturnValue('darwin')

// Must import after mocks
import { FileWatcher } from '@main/services/watcher'

function getWatcherMock() {
  return mockFsWatch() as ReturnType<typeof mockFsWatch>
}

describe('FileWatcher', () => {
  let watcher: FileWatcher

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    watcher = new FileWatcher()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('watch', () => {
    it('creates a native fs.watch with recursive: true', () => {
      watcher.watch('session-1', '/project', vi.fn())

      expect(mockFsWatch).toHaveBeenCalledWith('/project', { recursive: true })
    })

    it('stops existing watcher before creating new one for same session', () => {
      const mock = getWatcherMock()

      watcher.watch('session-1', '/project1', vi.fn())
      watcher.watch('session-1', '/project2', vi.fn())

      expect(mock.close).toHaveBeenCalled()
    })

    it('skips restart when watching same directory for same session', () => {
      watcher.watch('session-1', '/project', vi.fn())
      const mock = getWatcherMock()
      mock.close.mockClear()
      mockFsWatch.mockClear()

      watcher.watch('session-1', '/project', vi.fn())

      expect(mockFsWatch).not.toHaveBeenCalled()
      expect(mock.close).not.toHaveBeenCalled()
    })

    it('registers change and error event handlers', () => {
      watcher.watch('session-1', '/project', vi.fn())

      const mock = getWatcherMock()
      const registeredEvents = mock.on.mock.calls.map((c: any[]) => c[0])

      expect(registeredEvents).toContain('change')
      expect(registeredEvents).toContain('error')
    })

    it('debounces events by 300ms', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'file.ts')

      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledWith({
        sessionId: 'session-1',
        type: 'change',
        path: '/project/file.ts',
      })
    })

    it('deduplicates events by path within debounce window', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'file.ts')
      changeHandler('change', 'file.ts')
      changeHandler('change', 'file.ts')

      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('emits separate events for different paths', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'file1.ts')
      changeHandler('rename', 'file2.ts')

      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('resets debounce timer on new events', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'file.ts')
      vi.advanceTimersByTime(200)

      changeHandler('change', 'file2.ts')
      vi.advanceTimersByTime(200)

      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalled()
    })

    it('ignores events for node_modules, .git, and other ignored dirs', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'node_modules/foo/index.js')
      changeHandler('change', '.git/HEAD')
      changeHandler('change', 'dist/bundle.js')
      changeHandler('change', '__pycache__/mod.pyc')

      vi.advanceTimersByTime(300)

      expect(callback).not.toHaveBeenCalled()
    })

    it('ignores .log, .tmp, and .DS_Store files', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', 'app.log')
      changeHandler('change', 'temp.tmp')
      changeHandler('change', '.DS_Store')

      vi.advanceTimersByTime(300)

      expect(callback).not.toHaveBeenCalled()
    })

    it('ignores events with null filename', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('change', null)

      vi.advanceTimersByTime(300)

      expect(callback).not.toHaveBeenCalled()
    })

    it('calls onError and unwatches on EMFILE', () => {
      const callback = vi.fn()
      const onError = vi.fn()
      watcher.watch('session-1', '/project', callback, onError)

      const mock = getWatcherMock()
      const errorHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'error')![1]

      const emfileError = Object.assign(new Error('EMFILE'), { code: 'EMFILE' })
      errorHandler(emfileError)

      expect(onError).toHaveBeenCalledWith('session-1', emfileError)
      expect(mock.close).toHaveBeenCalled()
    })

    it('calls onError and unwatches on ENFILE', () => {
      const callback = vi.fn()
      const onError = vi.fn()
      watcher.watch('session-1', '/project', callback, onError)

      const mock = getWatcherMock()
      const errorHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'error')![1]

      const enfileError = Object.assign(new Error('ENFILE'), { code: 'ENFILE' })
      errorHandler(enfileError)

      expect(onError).toHaveBeenCalledWith('session-1', enfileError)
      expect(mock.close).toHaveBeenCalled()
    })

    it('calls onError and unwatches on ENOSPC', () => {
      const callback = vi.fn()
      const onError = vi.fn()
      watcher.watch('session-1', '/project', callback, onError)

      const mock = getWatcherMock()
      const errorHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'error')![1]

      const enospcError = Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })
      errorHandler(enospcError)

      expect(onError).toHaveBeenCalledWith('session-1', enospcError)
      expect(mock.close).toHaveBeenCalled()
    })

    it('does not unwatch on non-limit errors', () => {
      const callback = vi.fn()
      const onError = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      watcher.watch('session-1', '/project', callback, onError)

      const mock = getWatcherMock()
      mock.close.mockClear()
      const errorHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'error')![1]

      const otherError = Object.assign(new Error('EPERM'), { code: 'EPERM' })
      errorHandler(otherError)

      expect(onError).not.toHaveBeenCalled()
      expect(mock.close).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('handles missing onError callback gracefully', () => {
      const callback = vi.fn()
      // No onError passed
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const errorHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'error')![1]

      const emfileError = Object.assign(new Error('EMFILE'), { code: 'EMFILE' })
      // Should not throw
      errorHandler(emfileError)

      expect(mock.close).toHaveBeenCalled()
    })
  })

  describe('unwatch', () => {
    it('closes watcher and clears debounce timer', () => {
      watcher.watch('session-1', '/project', vi.fn())
      const mock = getWatcherMock()

      watcher.unwatch('session-1')

      expect(mock.close).toHaveBeenCalled()
    })

    it('cancels pending debounced events', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      // Trigger a change that starts debounce timer
      changeHandler('change', 'file.ts')

      // Unwatch before debounce fires
      watcher.unwatch('session-1')

      // Advance past debounce — callback should NOT fire
      vi.advanceTimersByTime(500)
      expect(callback).not.toHaveBeenCalled()
    })

    it('does nothing for non-existent session', () => {
      watcher.unwatch('nonexistent')
    })
  })

  describe('unwatchAll', () => {
    it('closes all watchers', () => {
      watcher.watch('session-1', '/project1', vi.fn())
      watcher.watch('session-2', '/project2', vi.fn())

      watcher.unwatchAll()

      expect(getWatcherMock().close).toHaveBeenCalled()
    })
  })
})

describe('FileWatcher WSL detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns false on WSL (skips watching)', async () => {
    mockPlatform.mockReturnValue('linux')
    mockReadFileSync.mockReturnValue('Linux version 5.15.0-1-microsoft-standard-WSL2')

    const { FileWatcher: WSLFileWatcher } = await import('@main/services/watcher')
    const w = new WSLFileWatcher()
    const result = w.watch('session-1', '/project', vi.fn())

    expect(result).toBe(false)
    expect(mockFsWatch).not.toHaveBeenCalled()
  })

  it('returns true on native Linux (starts watching)', async () => {
    mockPlatform.mockReturnValue('linux')
    mockReadFileSync.mockReturnValue('Linux version 6.1.0-generic')

    const { FileWatcher: LinuxFileWatcher } = await import('@main/services/watcher')
    const w = new LinuxFileWatcher()
    const result = w.watch('session-1', '/project', vi.fn())

    expect(result).toBe(true)
    expect(mockFsWatch).toHaveBeenCalled()
  })

  it('returns true on macOS (starts watching)', async () => {
    mockPlatform.mockReturnValue('darwin')

    const { FileWatcher: DarwinFileWatcher } = await import('@main/services/watcher')
    const w = new DarwinFileWatcher()
    const result = w.watch('session-1', '/project', vi.fn())

    expect(result).toBe(true)
    expect(mockFsWatch).toHaveBeenCalled()
  })

  it('handles /proc/version read failure gracefully (not WSL)', async () => {
    mockPlatform.mockReturnValue('linux')
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })

    const { FileWatcher: FallbackFileWatcher } = await import('@main/services/watcher')
    const w = new FallbackFileWatcher()
    const result = w.watch('session-1', '/project', vi.fn())

    expect(result).toBe(true)
    expect(mockFsWatch).toHaveBeenCalled()
  })
})
