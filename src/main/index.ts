import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  dialog,
  nativeImage,
  screen,
  session,
  shell,
} from 'electron'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { platform } from 'os'

// Dev mode requires an unpackaged build — a packaged app must never honor
// VITE_DEV_SERVER_URL or NODE_ENV, as that would let env vars trick it
// into loading remote content in the privileged BrowserWindow.
const isDev = !app.isPackaged && (
  process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL
)

// Suppress security warning in dev mode (Vite requires unsafe-eval for HMR)
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}
import { join } from 'path'
import { registerPtyHandlers, ptyManager } from './ipc/pty'
import { registerGitHandlers } from './ipc/git'
import { registerFsHandlers, fileWatcher } from './ipc/fs'
import { registerGrammarHandlers } from './ipc/grammar'
import { AUTOMATION_CHANNELS, AutomationBootstrapResult, TERMINAL_MENU_CHANNELS } from '@shared/types'
import { createAppMenu } from './menu'
import { debugLog } from './logger'
import { validateIpcSender } from './security/validate-sender'
import {
  assertAutomationBootstrapResult,
  assertFiniteNumber,
  assertBoolean,
  assertNonEmptyString,
} from './security/validate-ipc-params'
import { isTrustedRendererUrl } from './security/trusted-renderer'
import { AutomationApiService } from './services/automation-api'

function isWSL(): boolean {
  if (platform() !== 'linux') return false
  try {
    return readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

let mainWindow: BrowserWindow | null = null
let automationApiService: AutomationApiService | null = null
let rendererReady = false

interface PendingAutomationRequest {
  resolve: (sessionId: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const pendingAutomationRequests = new Map<string, PendingAutomationRequest>()

function rejectPendingAutomationRequests(reason: string): void {
  for (const [requestId, pending] of pendingAutomationRequests) {
    clearTimeout(pending.timeout)
    pending.reject(new Error(reason))
    pendingAutomationRequests.delete(requestId)
  }
}

function requestRendererBootstrap(cwd: string, commands: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!rendererReady) {
      reject(new Error('Renderer is not ready for automation requests'))
      return
    }
    if (!mainWindow) {
      reject(new Error('Main window is not available'))
      return
    }

    const requestId = randomUUID()
    const timeout = setTimeout(() => {
      pendingAutomationRequests.delete(requestId)
      reject(new Error('Timed out waiting for renderer automation response'))
    }, 15_000)
    timeout.unref()

    pendingAutomationRequests.set(requestId, { resolve, reject, timeout })
    sendToRenderer(AUTOMATION_CHANNELS.BOOTSTRAP_REQUEST, {
      requestId,
      cwd,
      commands,
    })
  })
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  // Size window to 80% of screen, with reasonable limits
  const width = Math.min(Math.max(Math.round(screenWidth * 0.8), 800), 1600)
  const height = Math.min(Math.max(Math.round(screenHeight * 0.8), 600), 1000)

  // Center the window
  const x = Math.round((screenWidth - width) / 2)
  const y = Math.round((screenHeight - height) / 2)

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    frame: false,
    show: false,
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Prevent navigation to untrusted URLs — if renderer content ever tries to navigate
  // (drag-drop, anchor click, window.location), block it unless it's a known-safe origin.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Load the app
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    rejectPendingAutomationRequests('Main window was closed')
    mainWindow = null
    rendererReady = false
  })
}

// Register all IPC handlers
function registerIpcHandlers() {
  debugLog('Registering IPC handlers...')
  registerPtyHandlers(ipcMain)
  registerGitHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  registerGrammarHandlers(ipcMain)
  debugLog('IPC handlers registered')

  ipcMain.on(AUTOMATION_CHANNELS.RENDERER_READY, (event) => {
    if (!validateIpcSender(event)) return
    rendererReady = true
  })

  ipcMain.on(AUTOMATION_CHANNELS.BOOTSTRAP_RESULT, (event, result: AutomationBootstrapResult) => {
    if (!validateIpcSender(event)) return

    try {
      assertAutomationBootstrapResult(result)
    } catch {
      return
    }

    const pending = pendingAutomationRequests.get(result.requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pendingAutomationRequests.delete(result.requestId)

    if (result.ok && result.sessionId) {
      pending.resolve(result.sessionId)
      return
    }

    pending.reject(new Error(result.error || 'Renderer rejected automation request'))
  })

  ipcMain.handle(AUTOMATION_CHANNELS.GET_STATUS, (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    if (!automationApiService) return { enabled: false }
    return automationApiService.getStatus()
  })

  ipcMain.handle(AUTOMATION_CHANNELS.SET_ENABLED, async (event, enabled: boolean) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertBoolean(enabled, 'enabled')
    if (!automationApiService) throw new Error('Automation API service is not available')
    return automationApiService.setEnabled(enabled)
  })

  // Directory selection dialog
  ipcMain.handle('fs:selectDirectory', async (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Window controls
  ipcMain.on('window:minimize', (event) => {
    if (!validateIpcSender(event)) return
    mainWindow?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    if (!validateIpcSender(event)) return
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    if (!validateIpcSender(event)) return
    mainWindow?.close()
  })

  ipcMain.handle('window:getPosition', (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    if (!mainWindow) return { x: 0, y: 0 }
    const [x, y] = mainWindow.getPosition()
    return { x, y }
  })

  ipcMain.on('window:setPosition', (event, x: number, y: number) => {
    if (!validateIpcSender(event)) return
    try {
      assertFiniteNumber(x, 'x')
      assertFiniteNumber(y, 'y')
    } catch {
      return
    }
    if (!mainWindow) return
    mainWindow.setPosition(Math.round(x), Math.round(y))
  })

  ipcMain.on('app:quit', (event) => {
    if (!validateIpcSender(event)) return
    app.quit()
  })

  // Terminal context menu
  ipcMain.on(TERMINAL_MENU_CHANNELS.SHOW, (event, sessionId: string, hasSelection: boolean, selectionText: string) => {
    if (!validateIpcSender(event)) return
    try {
      assertBoolean(hasSelection, 'hasSelection')
    } catch {
      return
    }
    const menu = Menu.buildFromTemplate([
      {
        label: 'Copy',
        enabled: hasSelection,
        click: () => {
          if (typeof selectionText === 'string' && selectionText) {
            clipboard.writeText(selectionText)
          }
        },
      },
      {
        label: 'Paste',
        click: () => event.sender.send(TERMINAL_MENU_CHANNELS.ACTION, sessionId, 'paste'),
      },
      { type: 'separator' },
      {
        label: 'Select All',
        click: () => event.sender.send(TERMINAL_MENU_CHANNELS.ACTION, sessionId, 'selectAll'),
      },
      {
        label: 'Clear',
        click: () => event.sender.send(TERMINAL_MENU_CHANNELS.ACTION, sessionId, 'clear'),
      },
    ])
    menu.popup()
  })

  // Open URLs in system browser (WSL2-aware)
  ipcMain.handle('shell:openExternal', async (event, url: string) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    assertNonEmptyString(url, 'url')
    if (!/^https?:\/\//i.test(url)) return

    if (isWSL()) {
      // On WSL2, shell.openExternal uses xdg-open which may not reach the Windows browser.
      // WSLg holds onto focus so the browser opens in the background — unavoidable.
      execFile('explorer.exe', [url])
    } else {
      await shell.openExternal(url)
    }
  })
}

app.whenReady().then(async () => {
  debugLog('App ready, initializing...')

  // Set Content-Security-Policy in production only.
  // Dev mode is excluded: Vite HMR needs WebSocket (ws:) connections and unsafe-eval,
  // and onHeadersReceived applies to all responses which breaks the dev server.
  if (!isDev) {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self';"
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
  }

  // Deny all permission requests except clipboard — a terminal emulator needs no
  // browser permissions (camera, microphone, geolocation, notifications, etc.)
  // but right-click paste requires clipboard-read.
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) =>
    cb(perm === 'clipboard-read' || perm === 'clipboard-sanitized-write')
  )

  // Set dock icon on macOS in dev mode (packaged apps use the .icns from the app bundle)
  if (process.platform === 'darwin' && app.dock && !app.isPackaged) {
    app.dock.setIcon(nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')))
  }

  createAppMenu()
  registerIpcHandlers()

  automationApiService = new AutomationApiService(app.getPath('userData'), async ({ cwd, commands }) => {
    const sessionId = await requestRendererBootstrap(cwd, commands)
    return { sessionId }
  })
  await automationApiService.start().catch((error) => {
    console.error('Failed to start automation API:', error)
  })

  createWindow()
  debugLog('Window created')

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked and no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  rejectPendingAutomationRequests('Application is quitting')
  ptyManager.killAll()
  fileWatcher.unwatchAll()
  if (automationApiService) {
    void automationApiService.stop().catch((error) => {
      console.error('Failed to stop automation API:', error)
    })
  }
})

// Send events to renderer
export function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args)
}
