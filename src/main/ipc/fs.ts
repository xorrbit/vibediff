import { IpcMain } from 'electron'
import { homedir } from 'os'
import { FS_CHANNELS } from '@shared/types'
import { FileWatcher } from '../services/watcher'
import { sendToRenderer } from '../index'
import { validateIpcSender } from '../security/validate-sender'

export const fileWatcher = new FileWatcher()

export function registerFsHandlers(ipcMain: IpcMain) {
  ipcMain.handle(FS_CHANNELS.WATCH_START, async (event, sessionId: string, dir: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    return fileWatcher.watch(sessionId, dir, (event) => {
      sendToRenderer(FS_CHANNELS.FILE_CHANGED, event)
    })
  })

  ipcMain.handle(FS_CHANNELS.WATCH_STOP, async (event, sessionId: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    fileWatcher.unwatch(sessionId)
  })

  ipcMain.handle(FS_CHANNELS.GET_HOME_DIR, (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    return homedir()
  })
}
