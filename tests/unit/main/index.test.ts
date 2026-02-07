import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state, mocks, resetState, makeWindow } = vi.hoisted(() => {
  const state = {
    isPackaged: false,
    osPlatform: 'linux',
    procVersion: 'linux',
    whenReadyPromise: Promise.resolve(),
    whenReadyResolve: (() => {}) as () => void,
    appEvents: new Map<string, (...args: any[]) => any>(),
    ipcHandles: new Map<string, (...args: any[]) => any>(),
    ipcEvents: new Map<string, (...args: any[]) => any>(),
    createdWindows: [] as any[],
    webRequestHandler: null as ((details: any, callback: (response: any) => void) => void) | null,
    permissionHandler: null as ((wc: any, perm: any, cb: (allowed: boolean) => void) => void) | null,
  }

  const mocks = {
    registerPtyHandlers: vi.fn(),
    registerGitHandlers: vi.fn(),
    registerFsHandlers: vi.fn(),
    registerGrammarHandlers: vi.fn(),
    ptyKillAll: vi.fn(),
    watcherUnwatchAll: vi.fn(),
    createAppMenu: vi.fn(),
    debugLog: vi.fn(),
    validateIpcSender: vi.fn(() => true),
    isTrustedRendererUrl: vi.fn(() => true),
    shellOpenExternal: vi.fn().mockResolvedValue(undefined),
    dialogShowOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp'] }),
    execFile: vi.fn(),
    readFileSync: vi.fn(() => state.procVersion),
    nativeImageCreateFromPath: vi.fn(),
    menuPopup: vi.fn(),
    appQuit: vi.fn(),
  }

  function makeWindow(options: any) {
    const webContentsHandlers = new Map<string, (...args: any[]) => any>()
    const windowHandlers = new Map<string, (...args: any[]) => any>()

    const instance = {
      _options: options,
      _webContentsHandlers: webContentsHandlers,
      _windowHandlers: windowHandlers,
      webContents: {
        on: vi.fn((channel: string, handler: (...args: any[]) => any) => {
          webContentsHandlers.set(channel, handler)
        }),
        setWindowOpenHandler: vi.fn(),
        send: vi.fn(),
      },
      once: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        windowHandlers.set(channel, handler)
      }),
      show: vi.fn(),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn(() => false),
      close: vi.fn(),
      getPosition: vi.fn(() => [111, 222]),
      setPosition: vi.fn(),
    }
    state.createdWindows.push(instance)
    return instance
  }

  function resetState() {
    state.isPackaged = false
    state.osPlatform = 'linux'
    state.procVersion = 'linux'
    state.appEvents = new Map()
    state.ipcHandles = new Map()
    state.ipcEvents = new Map()
    state.createdWindows = []
    state.webRequestHandler = null
    state.permissionHandler = null
    state.whenReadyPromise = new Promise<void>((resolve) => {
      state.whenReadyResolve = resolve
    })

    Object.values(mocks).forEach((mock) => {
      if (typeof mock === 'function' && 'mockReset' in mock) {
        ;(mock as any).mockReset()
      }
    })
    mocks.validateIpcSender.mockReturnValue(true)
    mocks.isTrustedRendererUrl.mockReturnValue(true)
    mocks.readFileSync.mockImplementation(() => state.procVersion)
    mocks.shellOpenExternal.mockResolvedValue(undefined)
    mocks.dialogShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp'] })
  }

  resetState()

  return { state, mocks, resetState, makeWindow }
})

vi.mock('@main/ipc/pty', () => ({
  registerPtyHandlers: mocks.registerPtyHandlers,
  ptyManager: { killAll: mocks.ptyKillAll },
}))

vi.mock('@main/ipc/git', () => ({
  registerGitHandlers: mocks.registerGitHandlers,
}))

vi.mock('@main/ipc/fs', () => ({
  registerFsHandlers: mocks.registerFsHandlers,
  fileWatcher: { unwatchAll: mocks.watcherUnwatchAll },
}))

vi.mock('@main/ipc/grammar', () => ({
  registerGrammarHandlers: mocks.registerGrammarHandlers,
}))

vi.mock('@main/menu', () => ({
  createAppMenu: mocks.createAppMenu,
}))

vi.mock('@main/logger', () => ({
  debugLog: mocks.debugLog,
}))

vi.mock('@main/security/validate-sender', () => ({
  validateIpcSender: mocks.validateIpcSender,
}))

vi.mock('@main/security/trusted-renderer', () => ({
  isTrustedRendererUrl: mocks.isTrustedRendererUrl,
}))

vi.mock('child_process', () => ({
  execFile: mocks.execFile,
  default: { execFile: mocks.execFile },
}))

vi.mock('fs', () => ({
  readFileSync: mocks.readFileSync,
  default: { readFileSync: mocks.readFileSync },
}))

vi.mock('os', () => ({
  platform: () => state.osPlatform,
  default: { platform: () => state.osPlatform },
}))

vi.mock('electron', () => {
  const BrowserWindow = vi.fn(function MockBrowserWindow(this: any, options: any) {
    return (globalThis as any).__makeWindow(options)
  }) as any
  BrowserWindow.getAllWindows = vi.fn(() => state.createdWindows)

  return {
    app: {
      get isPackaged() {
        return state.isPackaged
      },
      whenReady: vi.fn(() => state.whenReadyPromise),
      on: vi.fn((event: string, handler: (...args: any[]) => any) => {
        state.appEvents.set(event, handler)
      }),
      quit: mocks.appQuit,
      dock: {
        setIcon: vi.fn(),
      },
    },
    BrowserWindow,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        state.ipcHandles.set(channel, handler)
      }),
      on: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        state.ipcEvents.set(channel, handler)
      }),
    },
    Menu: {
      buildFromTemplate: vi.fn(() => ({ popup: mocks.menuPopup })),
    },
    dialog: {
      showOpenDialog: mocks.dialogShowOpenDialog,
    },
    nativeImage: {
      createFromPath: mocks.nativeImageCreateFromPath,
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1400, height: 900 },
      })),
    },
    session: {
      defaultSession: {
        webRequest: {
          onHeadersReceived: vi.fn((_filter: any, handler: any) => {
            state.webRequestHandler = handler
          }),
        },
        setPermissionRequestHandler: vi.fn((handler: any) => {
          state.permissionHandler = handler
        }),
      },
    },
    shell: {
      openExternal: mocks.shellOpenExternal,
    },
  }
})

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

async function importMain() {
  return await import('@main/index')
}

async function resolveWhenReady() {
  state.whenReadyResolve()
  await flushMicrotasks()
}

describe('main/index', () => {
  beforeEach(() => {
    ;(globalThis as any).__makeWindow = makeWindow
    vi.clearAllMocks()
    vi.resetModules()
    resetState()
    delete process.env.NODE_ENV
    delete process.env.VITE_DEV_SERVER_URL
    delete process.env.ELECTRON_DISABLE_SECURITY_WARNINGS
  })

  afterEach(() => {
    delete process.env.NODE_ENV
    delete process.env.VITE_DEV_SERVER_URL
    delete process.env.ELECTRON_DISABLE_SECURITY_WARNINGS
    delete (globalThis as any).__makeWindow
  })

  it('allows dev mode only when unpackaged and enforces secure BrowserWindow prefs', async () => {
    process.env.NODE_ENV = 'development'
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
    state.isPackaged = true

    await importMain()
    await resolveWhenReady()

    const win = state.createdWindows[0]
    expect(win._options.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    })
    expect(win.loadFile).toHaveBeenCalledTimes(1)
    expect(win.loadURL).not.toHaveBeenCalled()
    expect(process.env.ELECTRON_DISABLE_SECURITY_WARNINGS).toBeUndefined()
  })

  it('uses dev server only for unpackaged builds and skips production CSP hook in dev', async () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
    state.isPackaged = false

    await importMain()
    await resolveWhenReady()

    const win = state.createdWindows[0]
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(process.env.ELECTRON_DISABLE_SECURITY_WARNINGS).toBe('true')
    expect(state.webRequestHandler).toBeNull()
  })

  it('blocks untrusted navigation and denies window.open', async () => {
    mocks.isTrustedRendererUrl.mockImplementation((url: string) => url.includes('trusted'))

    await importMain()
    await resolveWhenReady()

    const win = state.createdWindows[0]
    const willNavigate = win._webContentsHandlers.get('will-navigate')!
    const blockedEvent = { preventDefault: vi.fn() }
    const trustedEvent = { preventDefault: vi.fn() }

    willNavigate(blockedEvent, 'https://evil.example')
    willNavigate(trustedEvent, 'https://trusted.example')

    expect(blockedEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(trustedEvent.preventDefault).not.toHaveBeenCalled()

    const windowOpenHandler = win.webContents.setWindowOpenHandler.mock.calls[0][0]
    expect(windowOpenHandler()).toEqual({ action: 'deny' })
  })

  it('registers CSP in non-dev mode and denies all permission requests', async () => {
    state.isPackaged = true

    await importMain()
    await resolveWhenReady()

    expect(state.webRequestHandler).toBeTypeOf('function')
    const callback = vi.fn()
    state.webRequestHandler?.({ responseHeaders: { 'X-Test': ['1'] } }, callback)

    const response = callback.mock.calls[0][0]
    expect(response.responseHeaders['Content-Security-Policy'][0]).toContain("default-src 'self'")

    const permCb = vi.fn()
    state.permissionHandler?.({}, 'camera', permCb)
    expect(permCb).toHaveBeenCalledWith(false)
  })

  it('gates window/app IPC handlers behind validateIpcSender', async () => {
    await importMain()
    await resolveWhenReady()

    const win = state.createdWindows[0]
    mocks.validateIpcSender.mockReturnValue(false)

    await expect(state.ipcHandles.get('fs:selectDirectory')!({ sender: {} }))
      .rejects.toThrow('Unauthorized IPC sender')
    expect(() => state.ipcHandles.get('window:getPosition')!({ sender: {} }))
      .toThrow('Unauthorized IPC sender')
    await expect(state.ipcHandles.get('shell:openExternal')!({ sender: {} }, 'https://example.com'))
      .rejects.toThrow('Unauthorized IPC sender')

    state.ipcEvents.get('window:minimize')!({ sender: {} })
    state.ipcEvents.get('window:maximize')!({ sender: {} })
    state.ipcEvents.get('window:close')!({ sender: {} })
    state.ipcEvents.get('window:setPosition')!({ sender: {} }, 10, 20)
    state.ipcEvents.get('app:quit')!({ sender: {} })
    state.ipcEvents.get('terminal:context-menu')!({ sender: { send: vi.fn() } }, true)

    expect(win.minimize).not.toHaveBeenCalled()
    expect(win.maximize).not.toHaveBeenCalled()
    expect(win.close).not.toHaveBeenCalled()
    expect(win.setPosition).not.toHaveBeenCalled()
    expect(mocks.appQuit).not.toHaveBeenCalled()
    expect(mocks.menuPopup).not.toHaveBeenCalled()
    expect(mocks.dialogShowOpenDialog).not.toHaveBeenCalled()
  })

  it('handles shell:openExternal protocol and WSL/non-WSL branching', async () => {
    await importMain()
    await resolveWhenReady()

    const handler = state.ipcHandles.get('shell:openExternal')!

    await handler({ sender: {} }, 'ftp://example.com')
    expect(mocks.shellOpenExternal).not.toHaveBeenCalled()
    expect(mocks.execFile).not.toHaveBeenCalled()

    state.osPlatform = 'darwin'
    await handler({ sender: {} }, 'https://example.com')
    expect(mocks.shellOpenExternal).toHaveBeenCalledWith('https://example.com')

    mocks.shellOpenExternal.mockClear()
    state.osPlatform = 'linux'
    state.procVersion = 'Linux version 5.15.0-microsoft-standard-WSL2'
    await handler({ sender: {} }, 'https://example.com/wsl')
    expect(mocks.execFile).toHaveBeenCalledWith('explorer.exe', ['https://example.com/wsl'])
    expect(mocks.shellOpenExternal).not.toHaveBeenCalled()
  })

  it('runs before-quit cleanup hooks', async () => {
    await importMain()

    state.appEvents.get('before-quit')?.()
    expect(mocks.ptyKillAll).toHaveBeenCalledTimes(1)
    expect(mocks.watcherUnwatchAll).toHaveBeenCalledTimes(1)
  })

  it('sendToRenderer no-ops without a window and sends once window exists', async () => {
    const mainModule = await importMain()

    expect(() => mainModule.sendToRenderer('pty:data', 'hello')).not.toThrow()

    await resolveWhenReady()
    const win = state.createdWindows[0]

    mainModule.sendToRenderer('pty:data', 'hello', 1)
    expect(win.webContents.send).toHaveBeenCalledWith('pty:data', 'hello', 1)
  })
})
