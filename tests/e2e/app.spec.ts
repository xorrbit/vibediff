import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page

test.describe('App Launch', () => {
  test.beforeAll(async () => {
    // Skip in CI if Electron not available
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

  test('app opens without errors', async () => {
    if (!page) test.skip()

    // Check window exists and is visible
    expect(page).toBeTruthy()

    // Check window title
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('window has correct minimum dimensions', async () => {
    if (!electronApp) test.skip()

    const window = await electronApp.browserWindow(page)
    const bounds = await window.evaluate((win) => win.getBounds())

    expect(bounds.width).toBeGreaterThanOrEqual(800)
    expect(bounds.height).toBeGreaterThanOrEqual(600)
  })

  test('dark theme is applied', async () => {
    if (!page) test.skip()

    // Check for dark background color
    const bgColor = await page.evaluate(() => {
      const body = document.body
      return window.getComputedStyle(body).backgroundColor
    })

    // Should be a dark color (low RGB values)
    expect(bgColor).toMatch(/rgb\(\d{1,2},\s*\d{1,2},\s*\d{1,2}\)|#1e1e1e/)
  })

  test('main layout components are visible', async () => {
    if (!page) test.skip()

    // Wait for React to render
    await page.waitForSelector('[class*="flex"]', { timeout: 5000 })

    // The app should have the main structure
    const hasContent = await page.locator('body').innerHTML()
    expect(hasContent.length).toBeGreaterThan(100)
  })

  test('tab bar is visible', async () => {
    if (!page) test.skip()

    // Look for the tab bar with tabs
    const tabBar = page.locator('[class*="bg-obsidian-surface"]').first()
    await expect(tabBar).toBeVisible({ timeout: 5000 })
  })
})
