// Session types
export interface Session {
  id: string
  cwd: string
  name: string
  bootstrapCommands?: string[]
}

// PTY IPC channels
export const PTY_CHANNELS = {
  SPAWN: 'pty:spawn',
  INPUT: 'pty:input',
  RESIZE: 'pty:resize',
  KILL: 'pty:kill',
  DATA: 'pty:data',
  EXIT: 'pty:exit',
  CWD_CHANGED: 'pty:cwdChanged',
  GET_FOREGROUND_PROCESS: 'pty:getForegroundProcess',
} as const

// Git IPC channels
export const GIT_CHANNELS = {
  GET_CURRENT_BRANCH: 'git:getCurrentBranch',
  GET_MAIN_BRANCH: 'git:getMainBranch',
  GET_CHANGED_FILES: 'git:getChangedFiles',
  GET_FILE_DIFF: 'git:getFileDiff',
  GET_FILE_CONTENT: 'git:getFileContent',
  FIND_GIT_ROOT: 'git:findGitRoot',
} as const

// File system IPC channels
export const FS_CHANNELS = {
  WATCH_START: 'fs:watchStart',
  WATCH_STOP: 'fs:watchStop',
  FILE_CHANGED: 'fs:fileChanged',
  WATCHER_ERROR: 'fs:watcherError',
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

// Terminal context menu IPC channels
export const TERMINAL_MENU_CHANNELS = {
  SHOW: 'terminal:context-menu',
  ACTION: 'terminal:context-menu-action',
} as const

// Grammar IPC channels
export const GRAMMAR_CHANNELS = {
  SCAN: 'grammar:scan',
  GET_ONIG_WASM: 'grammar:getOnigWasm',
} as const

// Automation IPC channels
export const AUTOMATION_CHANNELS = {
  BOOTSTRAP_REQUEST: 'automation:bootstrapRequest',
  BOOTSTRAP_RESULT: 'automation:bootstrapResult',
  RENDERER_READY: 'automation:rendererReady',
  GET_STATUS: 'automation:getStatus',
  SET_ENABLED: 'automation:setEnabled',
} as const

export interface AutomationBootstrapRequest {
  requestId: string
  cwd: string
  commands: string[]
}

export interface AutomationBootstrapResult {
  requestId: string
  ok: boolean
  sessionId?: string
  error?: string
}

export interface AutomationStatus {
  enabled: boolean
}

// Grammar types
export interface GrammarContribution {
  scopeName: string        // e.g. "source.python"
  languageId: string       // e.g. "python"
  fileExtensions: string[] // e.g. [".py", ".pyw"]
  rawContent: string       // raw grammar file content
  grammarPath: string      // original file path (for format detection)
}

export interface GrammarScanResult {
  grammars: GrammarContribution[]
  errors: string[]         // non-fatal errors encountered during scan
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
    onCwdChanged: (callback: (sessionId: string, cwd: string) => void) => () => void
    getCwd: (sessionId: string) => Promise<string | null>
    getForegroundProcess: (sessionId: string) => Promise<string | null>
  }
  git: {
    getCurrentBranch: (dir: string) => Promise<string | null>
    getMainBranch: (dir: string) => Promise<string | null>
    getChangedFiles: (dir: string, baseBranch?: string) => Promise<ChangedFile[]>
    getFileDiff: (dir: string, filePath: string, baseBranch?: string) => Promise<DiffContent | null>
    getFileContent: (dir: string, filePath: string, ref?: string) => Promise<string | null>
    findGitRoot: (dir: string) => Promise<string | null>
  }
  fs: {
    watchStart: (sessionId: string, dir: string) => Promise<boolean>
    watchStop: (sessionId: string) => Promise<void>
    onFileChanged: (callback: (event: FileChangeEvent) => void) => () => void
    onWatcherError: (callback: (sessionId: string) => void) => () => void
    selectDirectory: () => Promise<string | null>
    getHomeDir: () => Promise<string>
  }
  grammar: {
    scan: () => Promise<GrammarScanResult>
    getOnigWasm: () => Promise<Uint8Array | null>
  }
  terminal: {
    showContextMenu: (hasSelection: boolean, selectionText: string) => void
    onContextMenuAction: (callback: (action: string) => void) => () => void
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    quit: () => void
    getPosition: () => Promise<{ x: number; y: number }>
    setPosition: (x: number, y: number) => void
  }
  automation: {
    onBootstrapRequest: (callback: (request: AutomationBootstrapRequest) => void) => () => void
    sendBootstrapResult: (result: AutomationBootstrapResult) => void
    notifyRendererReady: () => void
    getStatus: () => Promise<AutomationStatus>
    setEnabled: (enabled: boolean) => Promise<AutomationStatus>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
