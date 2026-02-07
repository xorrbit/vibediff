import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron, closeElectron, shouldFailOnMissingPrereqs } from './electron'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('App Launch', () => {
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
  })

  test.afterAll(async () => {
    await closeElectron()
  })

  test('app opens without errors', async () => {
    skipIfLaunchUnavailable()

    // Check window exists and is visible
    expect(page).toBeTruthy()

    // Check window title
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('window has correct minimum dimensions', async () => {
    if (launchError || !electronApp || !page) test.skip()

    const window = await electronApp.browserWindow(page)
    const bounds = await window.evaluate((win) => win.getBounds())

    expect(bounds.width).toBeGreaterThanOrEqual(800)
    expect(bounds.height).toBeGreaterThanOrEqual(600)
  })

  test('dark theme is applied', async () => {
    skipIfLaunchUnavailable()

    // Check for dark background color
    const bgColor = await page.evaluate(() => {
      const body = document.body
      return window.getComputedStyle(body).backgroundColor
    })

    // Should be a dark color (low RGB values)
    expect(bgColor).toMatch(/rgb\(\d{1,2},\s*\d{1,2},\s*\d{1,2}\)|#1e1e1e/)
  })

  test('main layout components are visible', async () => {
    skipIfLaunchUnavailable()

    // Wait for React to render
    await page.waitForSelector('[class*="flex"]', { timeout: 5000 })

    // The app should have the main structure
    const hasContent = await page.locator('body').innerHTML()
    expect(hasContent.length).toBeGreaterThan(100)
  })

  test('tab bar is visible', async () => {
    skipIfLaunchUnavailable()

    // Look for the tab bar with tabs
    const tabBar = page.locator('[class*="bg-obsidian-surface"]').first()
    await expect(tabBar).toBeVisible({ timeout: 5000 })
  })
})
