import { contextBridge, ipcRenderer } from 'electron'
import {
  PTY_CHANNELS,
  GIT_CHANNELS,
  FS_CHANNELS,
  GRAMMAR_CHANNELS,
  TERMINAL_MENU_CHANNELS,
  PtySpawnOptions,
  PtyResizeOptions,
  ChangedFile,
  DiffContent,
  FileChangeEvent,
  ElectronAPI,
} from '@shared/types'

const electronAPI: ElectronAPI = {
  pty: {
    spawn: (options: PtySpawnOptions) =>
      ipcRenderer.invoke(PTY_CHANNELS.SPAWN, options),

    input: (sessionId: string, data: string) =>
      ipcRenderer.send(PTY_CHANNELS.INPUT, sessionId, data),

    resize: (options: PtyResizeOptions) =>
      ipcRenderer.send(PTY_CHANNELS.RESIZE, options),

    kill: (sessionId: string) =>
      ipcRenderer.send(PTY_CHANNELS.KILL, sessionId),

    onData: (callback: (sessionId: string, data: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) => {
        callback(sessionId, data)
      }
      ipcRenderer.on(PTY_CHANNELS.DATA, listener)
      return () => ipcRenderer.removeListener(PTY_CHANNELS.DATA, listener)
    },

    onExit: (callback: (sessionId: string, code: number) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sessionId: string, code: number) => {
        callback(sessionId, code)
      }
      ipcRenderer.on(PTY_CHANNELS.EXIT, listener)
      return () => ipcRenderer.removeListener(PTY_CHANNELS.EXIT, listener)
    },

    getCwd: (sessionId: string): Promise<string | null> =>
      ipcRenderer.invoke('pty:getCwd', sessionId),
  },

  git: {
    getCurrentBranch: (dir: string): Promise<string | null> =>
      ipcRenderer.invoke(GIT_CHANNELS.GET_CURRENT_BRANCH, dir),

    getMainBranch: (dir: string): Promise<string | null> =>
      ipcRenderer.invoke(GIT_CHANNELS.GET_MAIN_BRANCH, dir),

    getChangedFiles: (dir: string, baseBranch?: string): Promise<ChangedFile[]> =>
      ipcRenderer.invoke(GIT_CHANNELS.GET_CHANGED_FILES, dir, baseBranch),

    getFileDiff: (dir: string, filePath: string, baseBranch?: string): Promise<DiffContent | null> =>
      ipcRenderer.invoke(GIT_CHANNELS.GET_FILE_DIFF, dir, filePath, baseBranch),

    getFileContent: (dir: string, filePath: string, ref?: string): Promise<string | null> =>
      ipcRenderer.invoke(GIT_CHANNELS.GET_FILE_CONTENT, dir, filePath, ref),

    findGitRoot: (dir: string): Promise<string | null> =>
      ipcRenderer.invoke(GIT_CHANNELS.FIND_GIT_ROOT, dir),
  },

  fs: {
    watchStart: (sessionId: string, dir: string): Promise<boolean> =>
      ipcRenderer.invoke(FS_CHANNELS.WATCH_START, sessionId, dir),

    watchStop: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(FS_CHANNELS.WATCH_STOP, sessionId),

    onFileChanged: (callback: (event: FileChangeEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, changeEvent: FileChangeEvent) => {
        callback(changeEvent)
      }
      ipcRenderer.on(FS_CHANNELS.FILE_CHANGED, listener)
      return () => ipcRenderer.removeListener(FS_CHANNELS.FILE_CHANGED, listener)
    },

    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke(FS_CHANNELS.SELECT_DIRECTORY),

    getHomeDir: (): Promise<string> =>
      ipcRenderer.invoke(FS_CHANNELS.GET_HOME_DIR),
  },

  grammar: {
    scan: () => ipcRenderer.invoke(GRAMMAR_CHANNELS.SCAN),
    getOnigWasm: () => ipcRenderer.invoke(GRAMMAR_CHANNELS.GET_ONIG_WASM),
  },

  terminal: {
    showContextMenu: (hasSelection: boolean) =>
      ipcRenderer.send(TERMINAL_MENU_CHANNELS.SHOW, hasSelection),

    onContextMenuAction: (callback: (action: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, action: string) => {
        callback(action)
      }
      ipcRenderer.on(TERMINAL_MENU_CHANNELS.ACTION, listener)
      return () => ipcRenderer.removeListener(TERMINAL_MENU_CHANNELS.ACTION, listener)
    },
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    quit: () => ipcRenderer.send('app:quit'),
    getPosition: () => ipcRenderer.invoke('window:getPosition'),
    setPosition: (x: number, y: number) => ipcRenderer.send('window:setPosition', x, y),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
