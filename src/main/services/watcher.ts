import { watch, FSWatcher, readFileSync } from 'fs'
import { join } from 'path'
import { platform } from 'os'
import { FileChangeEvent } from '@shared/types'
import { debugLog } from '../logger'

type WatcherCallback = (event: FileChangeEvent) => void
type ErrorCallback = (sessionId: string, error: Error) => void

interface WatcherInstance {
  watcher: FSWatcher
  watchedDir: string
  callback: WatcherCallback
  debounceTimer: NodeJS.Timeout | null
  pendingEvents: FileChangeEvent[]
}

const DEBOUNCE_MS = 300

// Directories/files to ignore (matched against path segments)
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  'vendor',
  'target',
  '__pycache__',
])

const IGNORED_EXTENSIONS = new Set(['.log', '.tmp'])
const IGNORED_FILES = new Set(['.DS_Store'])

function isIgnored(relativePath: string): boolean {
  const segments = relativePath.split('/')
  for (const seg of segments) {
    if (IGNORED_DIRS.has(seg)) return true
  }
  const filename = segments[segments.length - 1]
  if (IGNORED_FILES.has(filename)) return true
  for (const ext of IGNORED_EXTENSIONS) {
    if (filename.endsWith(ext)) return true
  }
  return false
}

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
  watch(sessionId: string, dir: string, callback: WatcherCallback, onError?: ErrorCallback): boolean {
    // Skip if existing watcher already covers the same directory
    const existing = this.watchers.get(sessionId)
    if (existing && existing.watchedDir === dir) {
      return true
    }

    // Stop any existing watcher for this session
    this.unwatch(sessionId)

    // WSL2: native fs.watch with recursive still uses inotify under the hood,
    // which overwhelms the 9P filesystem bridge and starves the event loop.
    // Skip file watching entirely — useGitDiff falls back to periodic git status.
    if (IS_WSL) return false

    debugLog('Starting file watcher:', { sessionId, dir })

    const fsWatcher = watch(dir, { recursive: true })

    const instance: WatcherInstance = {
      watcher: fsWatcher,
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

    fsWatcher.on('change', (_eventType: string, filename: string | null) => {
      if (!filename) return
      if (isIgnored(filename)) return

      const fullPath = join(dir, filename)
      // fs.watch reports 'rename' for add/unlink and 'change' for modifications.
      // Map both to 'change' since useGitDiff just refreshes git status either way.
      instance.pendingEvents.push({ sessionId, type: 'change', path: fullPath })
      emitDebounced()
    })

    fsWatcher.on('error', (error: NodeJS.ErrnoException) => {
      console.error(`Watcher error for session ${sessionId}:`, error)
      if (error.code === 'EMFILE' || error.code === 'ENFILE' || error.code === 'ENOSPC') {
        debugLog('Watcher hit OS limit, closing:', { sessionId, code: error.code })
        this.unwatch(sessionId)
        onError?.(sessionId, error)
      }
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
      debugLog('Stopping file watcher:', { sessionId })
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
