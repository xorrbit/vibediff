import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FS_CHANNELS,
  GIT_CHANNELS,
  GRAMMAR_CHANNELS,
  PTY_CHANNELS,
  TERMINAL_MENU_CHANNELS,
} from '@shared/types'

const { mockExposeInMainWorld, mockInvoke, mockSend, mockOn, mockRemoveListener } = vi.hoisted(() => ({
  mockExposeInMainWorld: vi.fn(),
  mockInvoke: vi.fn(),
  mockSend: vi.fn(),
  mockOn: vi.fn(),
  mockRemoveListener: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
  ipcRenderer: {
    invoke: mockInvoke,
    send: mockSend,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
}))

async function loadExposedApi() {
  vi.resetModules()
  await import('@/preload/index')
  expect(mockExposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object))
  return mockExposeInMainWorld.mock.calls[0][1] as any
}

describe('preload electronAPI bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes electronAPI through contextBridge', async () => {
    await loadExposedApi()
    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1)
  })

  it('maps invoke/send channels with the expected argument order', async () => {
    const api = await loadExposedApi()
    const spawnOptions = { sessionId: 's1', cwd: '/repo' }

    await api.pty.spawn(spawnOptions)
    api.pty.input('s1', 'echo hi')
    api.pty.resize({ sessionId: 's1', cols: 80, rows: 24 })
    api.pty.kill('s1')
    await api.pty.getCwd('s1')

    await api.git.getCurrentBranch('/repo')
    await api.git.getMainBranch('/repo')
    await api.git.getChangedFiles('/repo', 'main')
    await api.git.getFileDiff('/repo', 'a.ts', 'main')
    await api.git.getFileContent('/repo', 'a.ts', 'HEAD')
    await api.git.findGitRoot('/repo')

    await api.fs.watchStart('s1', '/repo')
    await api.fs.watchStop('s1')
    await api.fs.selectDirectory()
    await api.fs.getHomeDir()

    await api.grammar.scan()
    await api.grammar.getOnigWasm()

    api.terminal.showContextMenu(true)
    await api.shell.openExternal('https://example.com')
    api.window.minimize()
    api.window.maximize()
    api.window.close()
    api.window.quit()
    await api.window.getPosition()
    api.window.setPosition(10, 20)

    expect(mockInvoke).toHaveBeenCalledWith(PTY_CHANNELS.SPAWN, spawnOptions)
    expect(mockSend).toHaveBeenCalledWith(PTY_CHANNELS.INPUT, 's1', 'echo hi')
    expect(mockSend).toHaveBeenCalledWith(PTY_CHANNELS.RESIZE, { sessionId: 's1', cols: 80, rows: 24 })
    expect(mockSend).toHaveBeenCalledWith(PTY_CHANNELS.KILL, 's1')
    expect(mockInvoke).toHaveBeenCalledWith('pty:getCwd', 's1')

    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.GET_CURRENT_BRANCH, '/repo')
    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.GET_MAIN_BRANCH, '/repo')
    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.GET_CHANGED_FILES, '/repo', 'main')
    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.GET_FILE_DIFF, '/repo', 'a.ts', 'main')
    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.GET_FILE_CONTENT, '/repo', 'a.ts', 'HEAD')
    expect(mockInvoke).toHaveBeenCalledWith(GIT_CHANNELS.FIND_GIT_ROOT, '/repo')

    expect(mockInvoke).toHaveBeenCalledWith(FS_CHANNELS.WATCH_START, 's1', '/repo')
    expect(mockInvoke).toHaveBeenCalledWith(FS_CHANNELS.WATCH_STOP, 's1')
    expect(mockInvoke).toHaveBeenCalledWith(FS_CHANNELS.SELECT_DIRECTORY)
    expect(mockInvoke).toHaveBeenCalledWith(FS_CHANNELS.GET_HOME_DIR)

    expect(mockInvoke).toHaveBeenCalledWith(GRAMMAR_CHANNELS.SCAN)
    expect(mockInvoke).toHaveBeenCalledWith(GRAMMAR_CHANNELS.GET_ONIG_WASM)

    expect(mockSend).toHaveBeenCalledWith(TERMINAL_MENU_CHANNELS.SHOW, true)
    expect(mockInvoke).toHaveBeenCalledWith('shell:openExternal', 'https://example.com')
    expect(mockSend).toHaveBeenCalledWith('window:minimize')
    expect(mockSend).toHaveBeenCalledWith('window:maximize')
    expect(mockSend).toHaveBeenCalledWith('window:close')
    expect(mockSend).toHaveBeenCalledWith('app:quit')
    expect(mockInvoke).toHaveBeenCalledWith('window:getPosition')
    expect(mockSend).toHaveBeenCalledWith('window:setPosition', 10, 20)
  })

  it('registers listeners and returns working unsubscribe functions', async () => {
    const api = await loadExposedApi()

    const ptyDataCb = vi.fn()
    const ptyExitCb = vi.fn()
    const cwdCb = vi.fn()
    const fileChangedCb = vi.fn()
    const contextMenuCb = vi.fn()

    let dataListener: (...args: any[]) => void = () => {}
    let exitListener: (...args: any[]) => void = () => {}
    let cwdListener: (...args: any[]) => void = () => {}
    let fileListener: (...args: any[]) => void = () => {}
    let menuListener: (...args: any[]) => void = () => {}

    mockOn.mockImplementation((channel: string, listener: (...args: any[]) => void) => {
      if (channel === PTY_CHANNELS.DATA) dataListener = listener
      if (channel === PTY_CHANNELS.EXIT) exitListener = listener
      if (channel === PTY_CHANNELS.CWD_CHANGED) cwdListener = listener
      if (channel === FS_CHANNELS.FILE_CHANGED) fileListener = listener
      if (channel === TERMINAL_MENU_CHANNELS.ACTION) menuListener = listener
    })

    const unsubscribeData = api.pty.onData(ptyDataCb)
    const unsubscribeExit = api.pty.onExit(ptyExitCb)
    const unsubscribeCwd = api.pty.onCwdChanged(cwdCb)
    const unsubscribeFile = api.fs.onFileChanged(fileChangedCb)
    const unsubscribeMenu = api.terminal.onContextMenuAction(contextMenuCb)

    dataListener({}, 's1', 'output')
    exitListener({}, 's1', 130)
    cwdListener({}, 's1', '/repo/new')
    fileListener({}, { sessionId: 's1', type: 'change', path: 'src/a.ts' })
    menuListener({}, 'copy')

    expect(ptyDataCb).toHaveBeenCalledWith('s1', 'output')
    expect(ptyExitCb).toHaveBeenCalledWith('s1', 130)
    expect(cwdCb).toHaveBeenCalledWith('s1', '/repo/new')
    expect(fileChangedCb).toHaveBeenCalledWith({ sessionId: 's1', type: 'change', path: 'src/a.ts' })
    expect(contextMenuCb).toHaveBeenCalledWith('copy')

    unsubscribeData()
    unsubscribeExit()
    unsubscribeCwd()
    unsubscribeFile()
    unsubscribeMenu()

    expect(mockRemoveListener).toHaveBeenCalledWith(PTY_CHANNELS.DATA, dataListener)
    expect(mockRemoveListener).toHaveBeenCalledWith(PTY_CHANNELS.EXIT, exitListener)
    expect(mockRemoveListener).toHaveBeenCalledWith(PTY_CHANNELS.CWD_CHANGED, cwdListener)
    expect(mockRemoveListener).toHaveBeenCalledWith(FS_CHANNELS.FILE_CHANGED, fileListener)
    expect(mockRemoveListener).toHaveBeenCalledWith(TERMINAL_MENU_CHANNELS.ACTION, menuListener)
  })
})
