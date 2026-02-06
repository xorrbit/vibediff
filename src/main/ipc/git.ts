import { IpcMain } from 'electron'
import { GIT_CHANNELS } from '@shared/types'
import { GitService } from '../services/git'

const gitService = new GitService()

export function registerGitHandlers(ipcMain: IpcMain) {
  ipcMain.handle(GIT_CHANNELS.GET_CURRENT_BRANCH, async (_event, dir: string) => {
    return gitService.getCurrentBranch(dir)
  })

  ipcMain.handle(GIT_CHANNELS.GET_MAIN_BRANCH, async (_event, dir: string) => {
    return gitService.getMainBranch(dir)
  })

  ipcMain.handle(GIT_CHANNELS.GET_CHANGED_FILES, async (_event, dir: string, baseBranch?: string) => {
    return gitService.getChangedFiles(dir, baseBranch)
  })

  ipcMain.handle(GIT_CHANNELS.GET_FILE_DIFF, async (_event, dir: string, filePath: string, baseBranch?: string) => {
    return gitService.getFileDiff(dir, filePath, baseBranch)
  })

  ipcMain.handle(GIT_CHANNELS.GET_FILE_CONTENT, async (_event, dir: string, filePath: string, ref?: string) => {
    return gitService.getFileContent(dir, filePath, ref)
  })

  ipcMain.handle(GIT_CHANNELS.FIND_GIT_ROOT, (_event, dir: string) => {
    return gitService.findGitRoot(dir)
  })
}
