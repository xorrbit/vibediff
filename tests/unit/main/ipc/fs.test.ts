import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FS_CHANNELS, type FileChangeEvent } from '@shared/types'

const {
  mockValidateIpcSender,
  mockSendToRenderer,
  mockWatch,
  mockUnwatch,
  mockHomedir,
} = vi.hoisted(() => ({
  mockValidateIpcSender: vi.fn(() => true),
  mockSendToRenderer: vi.fn(),
  mockWatch: vi.fn(),
  mockUnwatch: vi.fn(),
  mockHomedir: vi.fn(() => '/home/mock'),
}))

vi.mock('@main/security/validate-sender', () => ({
  validateIpcSender: mockValidateIpcSender,
}))

vi.mock('@main/index', () => ({
  sendToRenderer: mockSendToRenderer,
}))

vi.mock('os', () => ({
  homedir: mockHomedir,
  default: { homedir: mockHomedir },
}))

vi.mock('@main/services/watcher', () => ({
  FileWatcher: vi.fn(function MockFileWatcher(this: any) {
    this.watch = mockWatch
    this.unwatch = mockUnwatch
  }),
}))

import { registerFsHandlers } from '@main/ipc/fs'

function createIpcMainMock() {
  const handles = new Map<string, (...args: any[]) => any>()
  return {
    handles,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        handles.set(channel, handler)
      }),
    } as any,
  }
}

describe('registerFsHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateIpcSender.mockReturnValue(true)
  })

  it('rejects unauthorized sender for privileged handlers', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerFsHandlers(ipcMain)
    mockValidateIpcSender.mockReturnValue(false)

    await expect(
      handles.get(FS_CHANNELS.WATCH_START)!({ sender: {} }, 'session-a', '/repo')
    ).rejects.toThrow('Unauthorized IPC sender')
    await expect(
      handles.get(FS_CHANNELS.WATCH_STOP)!({ sender: {} }, 'session-a')
    ).rejects.toThrow('Unauthorized IPC sender')
    expect(() => handles.get(FS_CHANNELS.GET_HOME_DIR)!({ sender: {} }))
      .toThrow('Unauthorized IPC sender')
  })

  it('rejects malformed watch params', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerFsHandlers(ipcMain)

    await expect(
      handles.get(FS_CHANNELS.WATCH_START)!({ sender: {} }, '', '/repo')
    ).rejects.toThrow()
    await expect(
      handles.get(FS_CHANNELS.WATCH_START)!({ sender: {} }, 'session-a', '')
    ).rejects.toThrow()
    await expect(
      handles.get(FS_CHANNELS.WATCH_STOP)!({ sender: {} }, '')
    ).rejects.toThrow()

    expect(mockWatch).not.toHaveBeenCalled()
    expect(mockUnwatch).not.toHaveBeenCalled()
  })

  it('routes valid watchStart/watchStop requests and forwards watch callbacks', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerFsHandlers(ipcMain)
    mockWatch.mockResolvedValue(true)

    const watchStart = handles.get(FS_CHANNELS.WATCH_START)!
    await expect(watchStart({ sender: {} }, 'session-a', '/repo')).resolves.toBe(true)

    expect(mockWatch).toHaveBeenCalledWith(
      'session-a',
      '/repo',
      expect.any(Function)
    )

    const callback = mockWatch.mock.calls[0][2] as (event: FileChangeEvent) => void
    const changeEvent: FileChangeEvent = {
      sessionId: 'session-a',
      type: 'change',
      path: 'src/file.ts',
    }
    callback(changeEvent)
    expect(mockSendToRenderer).toHaveBeenCalledWith(FS_CHANNELS.FILE_CHANGED, changeEvent)

    const watchStop = handles.get(FS_CHANNELS.WATCH_STOP)!
    await watchStop({ sender: {} }, 'session-a')
    expect(mockUnwatch).toHaveBeenCalledWith('session-a')
  })

  it('returns home directory from GET_HOME_DIR', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerFsHandlers(ipcMain)

    expect(handles.get(FS_CHANNELS.GET_HOME_DIR)!({ sender: {} })).toBe('/home/mock')
    expect(mockHomedir).toHaveBeenCalled()
  })
})
