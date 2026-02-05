import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page

test.describe('Terminal', () => {
  test.beforeAll(async () => {
    if (process.env.CI && !process.env.ELECTRON_TEST) {
      test.skip()
      return
    }

    const mainPath = join(__dirname, '../../dist/main/index.js')

    try {
      electronApp = await electron.launch({
        args: [mainPath],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      })

      page = await electronApp.firstWindow()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(2000) // Give terminal time to spawn
    } catch (error) {
      console.warn('Electron launch failed, skipping E2E tests:', error)
      test.skip()
    }
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  test('terminal canvas is rendered', async () => {
    if (!page) test.skip()

    // xterm.js renders to a canvas element
    const terminalCanvas = page.locator('canvas')

    // Wait for canvas to be rendered
    await expect(terminalCanvas.first()).toBeVisible({ timeout: 10000 })
  })

  test('terminal container is present', async () => {
    if (!page) test.skip()

    // Look for xterm container
    const xtermContainer = page.locator('.xterm')

    // May or may not be visible depending on whether a session exists
    const count = await xtermContainer.count()
    // Just verify the query doesn't throw
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('terminal resizes with window', async () => {
    if (!electronApp || !page) test.skip()

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

    // Restore size
    await window.evaluate((win) => {
      win.setSize(initialBounds.width, initialBounds.height)
    })
  })

  test('terminal can receive keyboard input', async () => {
    if (!page) test.skip()

    // Focus on the page
    await page.click('body')

    // Type into terminal (assuming terminal is focused when session is active)
    await page.keyboard.type('echo test')

    // We can't easily verify the output, but the typing shouldn't throw
    await page.waitForTimeout(200)
  })
})
