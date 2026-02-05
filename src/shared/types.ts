// Session types
export interface Session {
  id: string
  cwd: string
  name: string
}

// PTY IPC channels
export const PTY_CHANNELS = {
  SPAWN: 'pty:spawn',
  INPUT: 'pty:input',
  RESIZE: 'pty:resize',
  KILL: 'pty:kill',
  DATA: 'pty:data',
  EXIT: 'pty:exit',
} as const

// Git IPC channels
export const GIT_CHANNELS = {
  GET_CURRENT_BRANCH: 'git:getCurrentBranch',
  GET_MAIN_BRANCH: 'git:getMainBranch',
  GET_CHANGED_FILES: 'git:getChangedFiles',
  GET_FILE_DIFF: 'git:getFileDiff',
  GET_FILE_CONTENT: 'git:getFileContent',
} as const

// File system IPC channels
export const FS_CHANNELS = {
  WATCH_START: 'fs:watchStart',
  WATCH_STOP: 'fs:watchStop',
  FILE_CHANGED: 'fs:fileChanged',
  SELECT_DIRECTORY: 'fs:selectDirectory',
  GET_HOME_DIR: 'fs:getHomeDir',
} as const

// PTY types
export interface PtySpawnOptions {
  sessionId: string
  cwd: string
  shell?: string
}

export interface PtyResizeOptions {
  sessionId: string
  cols: number
  rows: number
}

// Git types
export type FileStatus = 'A' | 'M' | 'D' | 'R' | '?'

export interface ChangedFile {
  path: string
  status: FileStatus
}

export interface DiffContent {
  original: string
  modified: string
}

// File watcher types
export interface FileChangeEvent {
  sessionId: string
  type: 'add' | 'change' | 'unlink'
  path: string
}

// Electron API exposed via preload
export interface ElectronAPI {
  pty: {
    spawn: (options: PtySpawnOptions) => Promise<void>
    input: (sessionId: string, data: string) => void
    resize: (options: PtyResizeOptions) => void
    kill: (sessionId: string) => void
    onData: (callback: (sessionId: string, data: string) => void) => () => void
    onExit: (callback: (sessionId: string, code: number) => void) => () => void
    getCwd: (sessionId: string) => Promise<string | null>
  }
  git: {
    getCurrentBranch: (dir: string) => Promise<string | null>
    getMainBranch: (dir: string) => Promise<string | null>
    getChangedFiles: (dir: string, baseBranch?: string) => Promise<ChangedFile[]>
    getFileDiff: (dir: string, filePath: string, baseBranch?: string) => Promise<DiffContent | null>
    getFileContent: (dir: string, filePath: string, ref?: string) => Promise<string | null>
  }
  fs: {
    watchStart: (sessionId: string, dir: string) => Promise<void>
    watchStop: (sessionId: string) => Promise<void>
    onFileChanged: (callback: (event: FileChangeEvent) => void) => () => void
    selectDirectory: () => Promise<string | null>
    getHomeDir: () => Promise<string>
  }
  menu: {
    onNewTab: (callback: () => void) => () => void
    onCloseTab: (callback: () => void) => () => void
    onShowHelp: (callback: () => void) => () => void
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    quit: () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
