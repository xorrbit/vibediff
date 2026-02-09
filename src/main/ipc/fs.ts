import { IpcMain } from 'electron'
import { homedir } from 'os'
import { FS_CHANNELS } from '@shared/types'
import { FileWatcher } from '../services/watcher'
import { sendToRenderer } from '../index'
import { validateIpcSender } from '../security/validate-sender'
import { assertNonEmptyString, assertSessionId } from '../security/validate-ipc-params'

export const fileWatcher = new FileWatcher()

export function registerFsHandlers(ipcMain: IpcMain) {
  ipcMain.handle(FS_CHANNELS.WATCH_START, async (event, sessionId: string, dir: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertSessionId(sessionId, 'sessionId')
    assertNonEmptyString(dir, 'dir')
    return fileWatcher.watch(
      sessionId,
      dir,
      (event) => {
        sendToRenderer(FS_CHANNELS.FILE_CHANGED, event)
      },
      (sid) => {
        sendToRenderer(FS_CHANNELS.WATCHER_ERROR, sid)
      }
    )
  })

  ipcMain.handle(FS_CHANNELS.WATCH_STOP, async (event, sessionId: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertSessionId(sessionId, 'sessionId')
    fileWatcher.unwatch(sessionId)
  })

  ipcMain.handle(FS_CHANNELS.GET_HOME_DIR, (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    return homedir()
  })
}
