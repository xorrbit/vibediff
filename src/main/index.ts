import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron'

// Suppress security warning in dev mode (Vite requires unsafe-eval for HMR)
if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}
import { join } from 'path'
import { registerPtyHandlers } from './ipc/pty'
import { registerGitHandlers } from './ipc/git'
import { registerFsHandlers } from './ipc/fs'
import { createAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null

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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for node-pty
    },
    frame: false,
    show: false,
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    // DevTools can be opened manually with Ctrl+Shift+I or from View menu
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Register all IPC handlers
function registerIpcHandlers() {
  console.log('Registering IPC handlers...')
  registerPtyHandlers(ipcMain)
  registerGitHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  console.log('IPC handlers registered')

  // Directory selection dialog
  ipcMain.handle('fs:selectDirectory', async () => {
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
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.on('app:quit', () => {
    app.quit()
  })
}

app.whenReady().then(() => {
  console.log('App ready, initializing...')
  createAppMenu()
  registerIpcHandlers()
  createWindow()
  console.log('Window created')

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

// Send events to renderer
export function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args)
}
