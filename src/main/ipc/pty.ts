import { IpcMain } from 'electron'
import { PTY_CHANNELS, PtySpawnOptions, PtyResizeOptions } from '@shared/types'
import { PtyManager } from '../services/pty-manager'
import { sendToRenderer } from '../index'
import { debugLog } from '../logger'
import { validateIpcSender } from '../security/validate-sender'
import {
  assertSessionId,
  assertString,
  assertPtySpawnOptions,
  assertPtyResizeOptions,
  MAX_PTY_DATA_LENGTH,
} from '../security/validate-ipc-params'

export const ptyManager = new PtyManager()

export function registerPtyHandlers(ipcMain: IpcMain) {
  ipcMain.handle(PTY_CHANNELS.SPAWN, async (event, options: PtySpawnOptions) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertPtySpawnOptions(options)
    const { sessionId, cwd, shell } = options
    debugLog('PTY spawn request:', { sessionId, cwd, shell })

    try {
      ptyManager.spawn(sessionId, cwd, shell, {
        onData: (data) => {
          sendToRenderer(PTY_CHANNELS.DATA, sessionId, data)
        },
        onExit: (code) => {
          sendToRenderer(PTY_CHANNELS.EXIT, sessionId, code)
        },
        onCwdChanged: (cwd) => {
          sendToRenderer(PTY_CHANNELS.CWD_CHANGED, sessionId, cwd)
        },
      })
    } catch (err) {
      console.error('Failed to spawn PTY:', err)
      throw err
    }
  })

  ipcMain.on(PTY_CHANNELS.INPUT, (event, sessionId: string, data: string) => {
    if (!validateIpcSender(event)) return
    try {
      assertSessionId(sessionId, 'sessionId')
      assertString(data, 'data', MAX_PTY_DATA_LENGTH)
    } catch {
      return
    }
    ptyManager.write(sessionId, data)
  })

  ipcMain.on(PTY_CHANNELS.RESIZE, (event, options: PtyResizeOptions) => {
    if (!validateIpcSender(event)) return
    try {
      assertPtyResizeOptions(options)
    } catch {
      return
    }
    ptyManager.resize(options.sessionId, options.cols, options.rows)
  })

  ipcMain.on(PTY_CHANNELS.KILL, (event, sessionId: string) => {
    if (!validateIpcSender(event)) return
    try {
      assertSessionId(sessionId, 'sessionId')
    } catch {
      return
    }
    ptyManager.kill(sessionId)
  })

  ipcMain.handle('pty:getCwd', (event, sessionId: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertSessionId(sessionId, 'sessionId')
    return ptyManager.getCwd(sessionId)
  })

  ipcMain.handle(PTY_CHANNELS.GET_FOREGROUND_PROCESS, (event, sessionId: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertSessionId(sessionId, 'sessionId')
    return ptyManager.getForegroundProcess(sessionId)
  })
}
