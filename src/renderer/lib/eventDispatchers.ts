import { FileChangeEvent } from '@shared/types'

type PtyDataHandler = (data: string) => void
type PtyExitHandler = (code: number) => void
type FileChangeHandler = (event: FileChangeEvent) => void
type WatcherErrorHandler = () => void

const ptyDataHandlers = new Map<string, Set<PtyDataHandler>>()
const ptyExitHandlers = new Map<string, Set<PtyExitHandler>>()
const fileChangeHandlers = new Map<string, Set<FileChangeHandler>>()
const watcherErrorHandlers = new Map<string, Set<WatcherErrorHandler>>()

let unsubscribePtyData: (() => void) | null = null
let unsubscribePtyExit: (() => void) | null = null
let unsubscribeFileChanged: (() => void) | null = null
let unsubscribeWatcherError: (() => void) | null = null

function getOrCreateSet<T>(map: Map<string, Set<T>>, sessionId: string): Set<T> {
  const existing = map.get(sessionId)
  if (existing) return existing
  const created = new Set<T>()
  map.set(sessionId, created)
  return created
}

function removeHandler<T>(map: Map<string, Set<T>>, sessionId: string, handler: T): void {
  const handlers = map.get(sessionId)
  if (!handlers) return
  handlers.delete(handler)
  if (handlers.size === 0) {
    map.delete(sessionId)
  }
}

function installPtyDataListener(): void {
  if (unsubscribePtyData) return
  unsubscribePtyData = window.electronAPI.pty.onData((sessionId, data) => {
    const handlers = ptyDataHandlers.get(sessionId)
    if (!handlers || handlers.size === 0) return
    for (const handler of handlers) {
      handler(data)
    }
  })
}

function installPtyExitListener(): void {
  if (unsubscribePtyExit) return
  unsubscribePtyExit = window.electronAPI.pty.onExit((sessionId, code) => {
    const handlers = ptyExitHandlers.get(sessionId)
    if (!handlers || handlers.size === 0) return
    for (const handler of handlers) {
      handler(code)
    }
  })
}

function installFileChangedListener(): void {
  if (unsubscribeFileChanged) return
  unsubscribeFileChanged = window.electronAPI.fs.onFileChanged((event) => {
    const handlers = fileChangeHandlers.get(event.sessionId)
    if (!handlers || handlers.size === 0) return
    for (const handler of handlers) {
      handler(event)
    }
  })
}

function maybeCleanupPtyDataListener(): void {
  if (ptyDataHandlers.size > 0 || !unsubscribePtyData) return
  unsubscribePtyData()
  unsubscribePtyData = null
}

function maybeCleanupPtyExitListener(): void {
  if (ptyExitHandlers.size > 0 || !unsubscribePtyExit) return
  unsubscribePtyExit()
  unsubscribePtyExit = null
}

function maybeCleanupFileChangedListener(): void {
  if (fileChangeHandlers.size > 0 || !unsubscribeFileChanged) return
  unsubscribeFileChanged()
  unsubscribeFileChanged = null
}

function installWatcherErrorListener(): void {
  if (unsubscribeWatcherError) return
  unsubscribeWatcherError = window.electronAPI.fs.onWatcherError((sessionId) => {
    const handlers = watcherErrorHandlers.get(sessionId)
    if (!handlers || handlers.size === 0) return
    for (const handler of handlers) {
      handler()
    }
  })
}

function maybeCleanupWatcherErrorListener(): void {
  if (watcherErrorHandlers.size > 0 || !unsubscribeWatcherError) return
  unsubscribeWatcherError()
  unsubscribeWatcherError = null
}

export function subscribePtyData(sessionId: string, handler: PtyDataHandler): () => void {
  installPtyDataListener()
  getOrCreateSet(ptyDataHandlers, sessionId).add(handler)

  return () => {
    removeHandler(ptyDataHandlers, sessionId, handler)
    maybeCleanupPtyDataListener()
  }
}

export function subscribePtyExit(sessionId: string, handler: PtyExitHandler): () => void {
  installPtyExitListener()
  getOrCreateSet(ptyExitHandlers, sessionId).add(handler)

  return () => {
    removeHandler(ptyExitHandlers, sessionId, handler)
    maybeCleanupPtyExitListener()
  }
}

export function subscribeFileChanged(sessionId: string, handler: FileChangeHandler): () => void {
  installFileChangedListener()
  getOrCreateSet(fileChangeHandlers, sessionId).add(handler)

  return () => {
    removeHandler(fileChangeHandlers, sessionId, handler)
    maybeCleanupFileChangedListener()
  }
}

export function subscribeWatcherError(sessionId: string, handler: WatcherErrorHandler): () => void {
  installWatcherErrorListener()
  getOrCreateSet(watcherErrorHandlers, sessionId).add(handler)

  return () => {
    removeHandler(watcherErrorHandlers, sessionId, handler)
    maybeCleanupWatcherErrorListener()
  }
}
