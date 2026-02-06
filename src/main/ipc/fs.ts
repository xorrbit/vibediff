import { IpcMain } from 'electron'
import { homedir } from 'os'
import { FS_CHANNELS } from '@shared/types'
import { FileWatcher } from '../services/watcher'
import { sendToRenderer } from '../index'

const fileWatcher = new FileWatcher()

export function registerFsHandlers(ipcMain: IpcMain) {
  ipcMain.handle(FS_CHANNELS.WATCH_START, async (_event, sessionId: string, dir: string) => {
    return fileWatcher.watch(sessionId, dir, (event) => {
      sendToRenderer(FS_CHANNELS.FILE_CHANGED, event)
    })
  })

  ipcMain.handle(FS_CHANNELS.WATCH_STOP, async (_event, sessionId: string) => {
    fileWatcher.unwatch(sessionId)
  })

  ipcMain.handle(FS_CHANNELS.GET_HOME_DIR, () => {
    return homedir()
  })
}
