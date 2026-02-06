import { IpcMain } from 'electron'
import { GIT_CHANNELS } from '@shared/types'
import { GitService } from '../services/git'
import { validateIpcSender } from '../security/validate-sender'
import { assertNonEmptyString, assertOptionalString } from '../security/validate-ipc-params'

const gitService = new GitService()

export function registerGitHandlers(ipcMain: IpcMain) {
  ipcMain.handle(GIT_CHANNELS.GET_CURRENT_BRANCH, async (event, dir: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    return gitService.getCurrentBranch(dir)
  })

  ipcMain.handle(GIT_CHANNELS.GET_MAIN_BRANCH, async (event, dir: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    return gitService.getMainBranch(dir)
  })

  ipcMain.handle(GIT_CHANNELS.GET_CHANGED_FILES, async (event, dir: string, baseBranch?: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    assertOptionalString(baseBranch, 'baseBranch')
    return gitService.getChangedFiles(dir, baseBranch)
  })

  ipcMain.handle(GIT_CHANNELS.GET_FILE_DIFF, async (event, dir: string, filePath: string, baseBranch?: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    assertNonEmptyString(filePath, 'filePath')
    assertOptionalString(baseBranch, 'baseBranch')
    return gitService.getFileDiff(dir, filePath, baseBranch)
  })

  ipcMain.handle(GIT_CHANNELS.GET_FILE_CONTENT, async (event, dir: string, filePath: string, ref?: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    assertNonEmptyString(filePath, 'filePath')
    assertOptionalString(ref, 'ref')
    return gitService.getFileContent(dir, filePath, ref)
  })

  ipcMain.handle(GIT_CHANNELS.FIND_GIT_ROOT, (event, dir: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(dir, 'dir')
    return gitService.findGitRoot(dir)
  })
}
