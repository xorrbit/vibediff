import { IpcMain } from 'electron'
import { PTY_CHANNELS, PtySpawnOptions, PtyResizeOptions } from '@shared/types'
import { PtyManager } from '../services/pty-manager'
import { sendToRenderer } from '../index'

export const ptyManager = new PtyManager()

export function registerPtyHandlers(ipcMain: IpcMain) {
  ipcMain.handle(PTY_CHANNELS.SPAWN, async (_event, options: PtySpawnOptions) => {
    const { sessionId, cwd, shell } = options

    try {
      ptyManager.spawn(sessionId, cwd, shell, {
        onData: (data) => {
          sendToRenderer(PTY_CHANNELS.DATA, sessionId, data)
        },
        onExit: (code) => {
          sendToRenderer(PTY_CHANNELS.EXIT, sessionId, code)
        },
      })
    } catch (err) {
      console.error('Failed to spawn PTY:', err)
      throw err
    }
  })

  ipcMain.on(PTY_CHANNELS.INPUT, (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data)
  })

  ipcMain.on(PTY_CHANNELS.RESIZE, (_event, options: PtyResizeOptions) => {
    ptyManager.resize(options.sessionId, options.cols, options.rows)
  })

  ipcMain.on(PTY_CHANNELS.KILL, (_event, sessionId: string) => {
    ptyManager.kill(sessionId)
  })

  ipcMain.handle('pty:getCwd', (_event, sessionId: string) => {
    return ptyManager.getCwd(sessionId)
  })
}
