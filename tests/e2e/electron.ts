import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication | null = null

export async function launchElectron(): Promise<{ app: ElectronApplication; page: Page }> {
  // Path to built electron main file
  const mainPath = join(__dirname, '../../dist/main/index.js')

  electronApp = await electron.launch({
    args: ['--no-sandbox', mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SANDBOX: '1',
    },
  })

  // Wait for the main window
  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return { app: electronApp, page }
}

export async function closeElectron(): Promise<void> {
  if (electronApp) {
    await electronApp.close()
    electronApp = null
  }
}

export function getElectronApp(): ElectronApplication | null {
  return electronApp
}
