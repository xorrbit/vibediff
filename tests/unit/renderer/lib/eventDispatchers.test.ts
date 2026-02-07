import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileChangeEvent } from '@shared/types'

interface ListenerStore {
  ptyData: ((sessionId: string, data: string) => void) | null
  ptyExit: ((sessionId: string, code: number) => void) | null
  fileChanged: ((event: FileChangeEvent) => void) | null
}

function setupGlobalListenerMocks() {
  const listeners: ListenerStore = {
    ptyData: null,
    ptyExit: null,
    fileChanged: null,
  }

  const unsubscribePtyData = vi.fn()
  const unsubscribePtyExit = vi.fn()
  const unsubscribeFileChanged = vi.fn()

  window.electronAPI.pty.onData = vi.fn((cb) => {
    listeners.ptyData = cb
    return unsubscribePtyData
  })
  window.electronAPI.pty.onExit = vi.fn((cb) => {
    listeners.ptyExit = cb
    return unsubscribePtyExit
  })
  window.electronAPI.fs.onFileChanged = vi.fn((cb) => {
    listeners.fileChanged = cb
    return unsubscribeFileChanged
  })

  return {
    listeners,
    unsubscribePtyData,
    unsubscribePtyExit,
    unsubscribeFileChanged,
  }
}

describe('eventDispatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('installs only one global PTY data listener regardless of subscriber count', async () => {
    const { unsubscribePtyData } = setupGlobalListenerMocks()
    const { subscribePtyData } = await import('@renderer/lib/eventDispatchers')

    const h1 = vi.fn()
    const h2 = vi.fn()
    const h3 = vi.fn()

    const un1 = subscribePtyData('session-a', h1)
    const un2 = subscribePtyData('session-a', h2)
    const un3 = subscribePtyData('session-b', h3)

    expect(window.electronAPI.pty.onData).toHaveBeenCalledTimes(1)

    un1()
    un2()
    expect(unsubscribePtyData).not.toHaveBeenCalled()

    un3()
    expect(unsubscribePtyData).toHaveBeenCalledTimes(1)
  })

  it('fans out events to matching session handlers only', async () => {
    const { listeners } = setupGlobalListenerMocks()
    const { subscribePtyData } = await import('@renderer/lib/eventDispatchers')

    const sessionA1 = vi.fn()
    const sessionA2 = vi.fn()
    const sessionB = vi.fn()

    subscribePtyData('session-a', sessionA1)
    subscribePtyData('session-a', sessionA2)
    subscribePtyData('session-b', sessionB)

    listeners.ptyData?.('session-a', 'hello')
    expect(sessionA1).toHaveBeenCalledWith('hello')
    expect(sessionA2).toHaveBeenCalledWith('hello')
    expect(sessionB).not.toHaveBeenCalled()

    listeners.ptyData?.('session-b', 'world')
    expect(sessionB).toHaveBeenCalledWith('world')
  })

  it('removes PTY exit callbacks after unsubscribe', async () => {
    const { listeners, unsubscribePtyExit } = setupGlobalListenerMocks()
    const { subscribePtyExit } = await import('@renderer/lib/eventDispatchers')

    const onExit = vi.fn()
    const unsubscribe = subscribePtyExit('session-a', onExit)

    listeners.ptyExit?.('session-a', 0)
    expect(onExit).toHaveBeenCalledWith(0)

    unsubscribe()
    expect(unsubscribePtyExit).toHaveBeenCalledTimes(1)

    listeners.ptyExit?.('session-a', 1)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('scopes file change events per session and stops callbacks after unsubscribe', async () => {
    const { listeners, unsubscribeFileChanged } = setupGlobalListenerMocks()
    const { subscribeFileChanged } = await import('@renderer/lib/eventDispatchers')

    const onA = vi.fn()
    const onB = vi.fn()
    const unsubA = subscribeFileChanged('session-a', onA)
    subscribeFileChanged('session-b', onB)

    listeners.fileChanged?.({ sessionId: 'session-a', type: 'change', path: 'src/a.ts' })
    expect(onA).toHaveBeenCalledWith({ sessionId: 'session-a', type: 'change', path: 'src/a.ts' })
    expect(onB).not.toHaveBeenCalled()

    unsubA()
    listeners.fileChanged?.({ sessionId: 'session-a', type: 'change', path: 'src/b.ts' })
    expect(onA).toHaveBeenCalledTimes(1)

    expect(unsubscribeFileChanged).not.toHaveBeenCalled()
  })
})
