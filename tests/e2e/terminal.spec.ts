import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron, closeElectron, shouldFailOnMissingPrereqs } from './electron'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('Terminal', () => {
  const skipIfLaunchUnavailable = () => {
    if (launchError || !page) test.skip(launchError?.message || 'Electron launch unavailable')
  }
  test.beforeAll(async () => {
    const launched = await launchElectron({ fixture: 'empty-home' })
    if ('error' in launched) {
      launchError = launched.error
      if (shouldFailOnMissingPrereqs()) {
        throw launchError
      }
      return
    }

    electronApp = launched.app
    page = launched.page
    await page.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeElectron()
  })

  test('terminal canvas is rendered', async () => {
    skipIfLaunchUnavailable()

    // xterm.js renders to either canvas (WebGL) or with rows/cursor elements
    // Check for xterm container with terminal content
    const xtermScreen = page.locator('.xterm-screen')

    // Wait for xterm screen to be rendered
    await expect(xtermScreen.first()).toBeVisible({ timeout: 10000 })
  })

  test('terminal container is present', async () => {
    skipIfLaunchUnavailable()

    const xtermContainer = page.locator('.xterm')
    await expect(xtermContainer.first()).toBeVisible({ timeout: 10000 })
  })

  test('terminal resizes with window', async () => {
    if (launchError || !electronApp || !page) test.skip()

    const window = await electronApp.browserWindow(page)

    // Get initial size
    const initialBounds = await window.evaluate((win) => win.getBounds())

    // Resize window
    await window.evaluate((win) => {
      win.setSize(1200, 800)
    })

    await page.waitForTimeout(500)

    // Get new bounds
    const newBounds = await window.evaluate((win) => win.getBounds())

    expect(newBounds.width).toBe(1200)
    expect(newBounds.height).toBe(800)

    // Restore size - pass initialBounds as argument since each evaluate runs in isolation
    await window.evaluate((win, bounds) => {
      win.setSize(bounds.width, bounds.height)
    }, initialBounds)
  })

  test('terminal can receive keyboard input', async () => {
    skipIfLaunchUnavailable()

    const terminalScreen = page.locator('.xterm-screen').first()
    const terminalRows = page.locator('.xterm-rows').first()
    await expect(terminalScreen).toBeVisible({ timeout: 10000 })
    await expect(terminalRows).toBeVisible({ timeout: 10000 })

    const before = await terminalRows.innerText()
    const marker = `CLAUDEDIDWHAT_E2E_${Date.now()}`

    await terminalScreen.click()
    await page.keyboard.type(`printf "${marker}\\n"`)
    await page.keyboard.press('Enter')

    await expect(terminalRows).toContainText(marker, { timeout: 10000 })
    const after = await terminalRows.innerText()
    expect(after).not.toBe(before)
  })
})
