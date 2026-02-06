import chokidar, { FSWatcher } from 'chokidar'
import { platform } from 'os'
import { readFileSync } from 'fs'
import { FileChangeEvent } from '@shared/types'

type WatcherCallback = (event: FileChangeEvent) => void

interface WatcherInstance {
  watcher: FSWatcher
  watchedDir: string
  callback: WatcherCallback
  debounceTimer: NodeJS.Timeout | null
  pendingEvents: FileChangeEvent[]
}

const DEBOUNCE_MS = 300

function isWSL(): boolean {
  if (platform() !== 'linux') return false
  try {
    return readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

const IS_WSL = isWSL()

export class FileWatcher {
  private watchers: Map<string, WatcherInstance> = new Map()

  /**
   * Start watching a directory for changes.
   */
  watch(sessionId: string, dir: string, callback: WatcherCallback): boolean {
    // Skip if existing watcher already covers the same directory
    const existing = this.watchers.get(sessionId)
    if (existing && existing.watchedDir === dir) {
      return true
    }

    // Stop any existing watcher for this session
    this.unwatch(sessionId)

    // WSL2: chokidar polling still stat()s every file in the tree every interval,
    // which overwhelms the 9P filesystem bridge and starves the event loop.
    // Skip file watching entirely — useGitDiff falls back to periodic git status.
    if (IS_WSL) return false

    const watcher = chokidar.watch(dir, {
      followSymlinks: false,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/.cache/**',
        '**/vendor/**',
        '**/target/**',
        '**/__pycache__/**',
        '**/*.log',
        '**/*.tmp',
        '**/.DS_Store',
      ],
      persistent: true,
      ignoreInitial: true,
      // Use native fs events (inotify/FSEvents) — WSL2 is excluded above
      usePolling: false,
      // Handle atomic saves (editors that write to temp file then rename)
      atomic: true,
      // Slight delay to batch rapid changes
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      // Limit depth to avoid watching deeply nested generated dirs
      depth: 10,
    })

    const instance: WatcherInstance = {
      watcher,
      watchedDir: dir,
      callback,
      debounceTimer: null,
      pendingEvents: [],
    }

    const emitDebounced = () => {
      if (instance.debounceTimer) {
        clearTimeout(instance.debounceTimer)
      }

      instance.debounceTimer = setTimeout(() => {
        // Emit all pending events (deduplicated by path)
        const uniqueEvents = new Map<string, FileChangeEvent>()
        for (const event of instance.pendingEvents) {
          uniqueEvents.set(event.path, event)
        }

        for (const event of uniqueEvents.values()) {
          instance.callback(event)
        }

        instance.pendingEvents = []
        instance.debounceTimer = null
      }, DEBOUNCE_MS)
    }

    const handleEvent = (type: FileChangeEvent['type'], path: string) => {
      instance.pendingEvents.push({
        sessionId,
        type,
        path,
      })
      emitDebounced()
    }

    watcher
      .on('add', (path) => handleEvent('add', path))
      .on('change', (path) => handleEvent('change', path))
      .on('unlink', (path) => handleEvent('unlink', path))
      .on('error', (error) => {
        console.error(`Watcher error for session ${sessionId}:`, error)
      })

    this.watchers.set(sessionId, instance)
    return true
  }

  /**
   * Stop watching for a session.
   */
  unwatch(sessionId: string): void {
    const instance = this.watchers.get(sessionId)
    if (instance) {
      if (instance.debounceTimer) {
        clearTimeout(instance.debounceTimer)
      }
      instance.watcher.close()
      this.watchers.delete(sessionId)
    }
  }

  /**
   * Stop all watchers (for cleanup on app exit).
   */
  unwatchAll(): void {
    for (const [sessionId] of this.watchers) {
      this.unwatch(sessionId)
    }
  }
}
