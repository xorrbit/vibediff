import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PTY_CHANNELS } from '@shared/types'

const {
  mockValidateIpcSender,
  mockSendToRenderer,
  mockSpawn,
  mockWrite,
  mockResize,
  mockKill,
  mockGetCwd,
  mockGetForegroundProcess,
} = vi.hoisted(() => ({
  mockValidateIpcSender: vi.fn(() => true),
  mockSendToRenderer: vi.fn(),
  mockSpawn: vi.fn(),
  mockWrite: vi.fn(),
  mockResize: vi.fn(),
  mockKill: vi.fn(),
  mockGetCwd: vi.fn(),
  mockGetForegroundProcess: vi.fn(),
}))

vi.mock('@main/security/validate-sender', () => ({
  validateIpcSender: mockValidateIpcSender,
}))

vi.mock('@main/index', () => ({
  sendToRenderer: mockSendToRenderer,
}))

vi.mock('@main/logger', () => ({
  debugLog: vi.fn(),
}))

vi.mock('@main/services/pty-manager', () => ({
  PtyManager: vi.fn(function MockPtyManager(this: any) {
    this.spawn = mockSpawn
    this.write = mockWrite
    this.resize = mockResize
    this.kill = mockKill
    this.getCwd = mockGetCwd
    this.getForegroundProcess = mockGetForegroundProcess
  }),
}))

import { registerPtyHandlers } from '@main/ipc/pty'

function createIpcMainMock() {
  const handles = new Map<string, (...args: any[]) => any>()
  const events = new Map<string, (...args: any[]) => any>()

  return {
    handles,
    events,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        handles.set(channel, handler)
      }),
      on: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        events.set(channel, handler)
      }),
    } as any,
  }
}

describe('registerPtyHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateIpcSender.mockReturnValue(true)
  })

  it('rejects unauthorized spawn requests', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const spawnHandler = handles.get(PTY_CHANNELS.SPAWN)!

    mockValidateIpcSender.mockReturnValue(false)

    await expect(
      spawnHandler({ sender: {} }, { sessionId: 's1', cwd: '/tmp' })
    ).rejects.toThrow('Unauthorized IPC sender')
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('forwards spawn callbacks to renderer channels', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const spawnHandler = handles.get(PTY_CHANNELS.SPAWN)!

    await spawnHandler({ sender: {} }, { sessionId: 'session-a', cwd: '/work' })

    expect(mockSpawn).toHaveBeenCalledWith(
      'session-a',
      '/work',
      undefined,
      expect.objectContaining({
        onData: expect.any(Function),
        onExit: expect.any(Function),
        onCwdChanged: expect.any(Function),
      })
    )

    const callbacks = mockSpawn.mock.calls[0][3]
    callbacks.onData('hello')
    callbacks.onExit(0)
    callbacks.onCwdChanged('/work/new')

    expect(mockSendToRenderer).toHaveBeenCalledWith(PTY_CHANNELS.DATA, 'session-a', 'hello')
    expect(mockSendToRenderer).toHaveBeenCalledWith(PTY_CHANNELS.EXIT, 'session-a', 0)
    expect(mockSendToRenderer).toHaveBeenCalledWith(PTY_CHANNELS.CWD_CHANGED, 'session-a', '/work/new')
  })

  it('propagates spawn errors', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const spawnHandler = handles.get(PTY_CHANNELS.SPAWN)!
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockSpawn.mockImplementationOnce(() => {
      throw new Error('spawn failed')
    })

    await expect(
      spawnHandler({ sender: {} }, { sessionId: 'session-a', cwd: '/work' })
    ).rejects.toThrow('spawn failed')
    consoleSpy.mockRestore()
  })

  it('ignores invalid INPUT payloads', () => {
    const { ipcMain, events } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const inputHandler = events.get(PTY_CHANNELS.INPUT)!

    inputHandler({ sender: {} }, '', 'hello')
    inputHandler({ sender: {} }, '../evil', 'hello')
    inputHandler({ sender: {} }, 'session-a', 42)

    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('writes valid INPUT payloads', () => {
    const { ipcMain, events } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const inputHandler = events.get(PTY_CHANNELS.INPUT)!

    inputHandler({ sender: {} }, 'session-a', 'hello')

    expect(mockWrite).toHaveBeenCalledWith('session-a', 'hello')
  })

  it('ignores invalid RESIZE and KILL payloads', () => {
    const { ipcMain, events } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const resizeHandler = events.get(PTY_CHANNELS.RESIZE)!
    const killHandler = events.get(PTY_CHANNELS.KILL)!

    resizeHandler({ sender: {} }, { sessionId: 'session-a', cols: 0, rows: 24 })
    resizeHandler({ sender: {} }, { sessionId: 'session-a', cols: 80, rows: 600 })
    resizeHandler({ sender: {} }, { sessionId: '../evil', cols: 80, rows: 24 })
    killHandler({ sender: {} }, '')
    killHandler({ sender: {} }, '../evil')

    expect(mockResize).not.toHaveBeenCalled()
    expect(mockKill).not.toHaveBeenCalled()
  })

  it('routes valid RESIZE and KILL payloads', () => {
    const { ipcMain, events } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const resizeHandler = events.get(PTY_CHANNELS.RESIZE)!
    const killHandler = events.get(PTY_CHANNELS.KILL)!

    resizeHandler({ sender: {} }, { sessionId: 'session-a', cols: 120, rows: 50 })
    killHandler({ sender: {} }, 'session-a')

    expect(mockResize).toHaveBeenCalledWith('session-a', 120, 50)
    expect(mockKill).toHaveBeenCalledWith('session-a')
  })

  it('rejects unauthorized pty:getCwd and returns cwd for valid requests', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const cwdHandler = handles.get('pty:getCwd')!

    mockValidateIpcSender.mockReturnValue(false)
    expect(() => cwdHandler({ sender: {} }, 'session-a')).toThrow('Unauthorized IPC sender')

    mockValidateIpcSender.mockReturnValue(true)
    mockGetCwd.mockReturnValue('/work/current')
    expect(cwdHandler({ sender: {} }, 'session-a')).toBe('/work/current')
  })

  it('rejects unauthorized foreground-process requests and returns value for valid requests', () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerPtyHandlers(ipcMain)
    const foregroundHandler = handles.get(PTY_CHANNELS.GET_FOREGROUND_PROCESS)!

    mockValidateIpcSender.mockReturnValue(false)
    expect(() => foregroundHandler({ sender: {} }, 'session-a')).toThrow('Unauthorized IPC sender')

    mockValidateIpcSender.mockReturnValue(true)
    mockGetForegroundProcess.mockReturnValue('claude')
    expect(foregroundHandler({ sender: {} }, 'session-a')).toBe('claude')
  })
})
