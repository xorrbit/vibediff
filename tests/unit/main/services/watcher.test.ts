import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockChokidarWatch, mockPlatform, mockReadFileSync } = vi.hoisted(() => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  }
  return {
    mockChokidarWatch: vi.fn(() => mockWatcher),
    mockPlatform: vi.fn(),
    mockReadFileSync: vi.fn(),
  }
})

vi.mock('chokidar', () => {
  const mod = { watch: mockChokidarWatch }
  return { ...mod, default: mod }
})

vi.mock('os', () => {
  const mod = { platform: mockPlatform }
  return { ...mod, default: mod }
})

vi.mock('fs', () => {
  const mod = { readFileSync: mockReadFileSync }
  return { ...mod, default: mod }
})

// Default: not WSL
mockPlatform.mockReturnValue('darwin')

// Must import after mocks
import { FileWatcher } from '@main/services/watcher'

function getWatcherMock() {
  return mockChokidarWatch() as ReturnType<typeof mockChokidarWatch>
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
    it('creates a chokidar watcher with correct options', () => {
      watcher.watch('session-1', '/project', vi.fn())

      expect(mockChokidarWatch).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          usePolling: false,
          depth: 10,
        })
      )
    })

    it('ignores common directories', () => {
      watcher.watch('session-1', '/project', vi.fn())

      const options = mockChokidarWatch.mock.calls[0][1]
      expect(options.ignored).toContain('**/node_modules/**')
      expect(options.ignored).toContain('**/.git/**')
      expect(options.ignored).toContain('**/dist/**')
    })

    it('disables symlink following', () => {
      watcher.watch('session-1', '/project', vi.fn())

      expect(mockChokidarWatch).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          followSymlinks: false,
        })
      )
    })

    it('stops existing watcher before creating new one for same session', () => {
      const mock = getWatcherMock()

      watcher.watch('session-1', '/project1', vi.fn())
      watcher.watch('session-1', '/project2', vi.fn())

      expect(mock.close).toHaveBeenCalled()
    })

    it('skips restart when watching same directory for same session', () => {
      watcher.watch('session-1', '/project', vi.fn())
      // Get the mock watcher *before* clearing call count
      const mock = getWatcherMock()
      mock.close.mockClear()
      mockChokidarWatch.mockClear()

      // Watch same dir again
      watcher.watch('session-1', '/project', vi.fn())

      // Should not have created a new chokidar watcher or closed the old one
      // (mockChokidarWatch calls from getWatcherMock are excluded since we cleared)
      expect(mockChokidarWatch).not.toHaveBeenCalled()
      expect(mock.close).not.toHaveBeenCalled()
    })

    it('registers event handlers for add, change, unlink, error', () => {
      watcher.watch('session-1', '/project', vi.fn())

      const mock = getWatcherMock()
      const registeredEvents = mock.on.mock.calls.map((c: any[]) => c[0])

      expect(registeredEvents).toContain('add')
      expect(registeredEvents).toContain('change')
      expect(registeredEvents).toContain('unlink')
      expect(registeredEvents).toContain('error')
    })

    it('debounces events by 300ms', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      // Trigger a change event
      changeHandler('/project/file.ts')

      // Should not fire immediately
      expect(callback).not.toHaveBeenCalled()

      // Advance by 300ms
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

      // Trigger multiple changes for the same file
      changeHandler('/project/file.ts')
      changeHandler('/project/file.ts')
      changeHandler('/project/file.ts')

      vi.advanceTimersByTime(300)

      // Should only fire once
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('emits separate events for different paths', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]
      const addHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'add')![1]

      changeHandler('/project/file1.ts')
      addHandler('/project/file2.ts')

      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('resets debounce timer on new events', () => {
      const callback = vi.fn()
      watcher.watch('session-1', '/project', callback)

      const mock = getWatcherMock()
      const changeHandler = mock.on.mock.calls.find((c: any[]) => c[0] === 'change')![1]

      changeHandler('/project/file.ts')
      vi.advanceTimersByTime(200)

      // New event resets the timer
      changeHandler('/project/file2.ts')
      vi.advanceTimersByTime(200)

      // Not yet fired (only 200ms since last event)
      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      // Now fired (300ms since last event)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('unwatch', () => {
    it('closes watcher and clears debounce timer', () => {
      watcher.watch('session-1', '/project', vi.fn())
      const mock = getWatcherMock()

      watcher.unwatch('session-1')

      expect(mock.close).toHaveBeenCalled()
    })

    it('does nothing for non-existent session', () => {
      // Should not throw
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
