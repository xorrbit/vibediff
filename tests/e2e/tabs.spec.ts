import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron, closeElectron, shouldFailOnMissingPrereqs } from './electron'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('Tab Management', () => {
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
    await page.waitForTimeout(1000)
  })

  test.afterAll(async () => {
    await closeElectron()
  })

  test('double-click on empty tab bar area creates new tab', async () => {
    skipIfLaunchUnavailable()

    const tabs = page.locator('button[class*="rounded-t-lg"]')
    const tabsBefore = await tabs.count()

    const emptyArea = page.locator('[data-testid="tabbar-empty-space"]').first()
    await emptyArea.dblclick()
    await expect.poll(async () => await tabs.count(), {
      timeout: 5000,
      message: 'Expected a new tab after double-clicking empty tab bar area',
    }).toBe(tabsBefore + 1)
  })

  test('tab bar shows tabs', async () => {
    skipIfLaunchUnavailable()

    // Check that the tab bar structure exists (uses obsidian theme)
    const tabBarArea = page.locator('[class*="flex"][class*="bg-obsidian-surface"]')
    await expect(tabBarArea.first()).toBeVisible({ timeout: 5000 })
  })

  test('Ctrl+T shortcut triggers new tab action', async () => {
    skipIfLaunchUnavailable()

    const tabs = page.locator('button[class*="rounded-t-lg"]')
    const tabsBefore = await tabs.count()

    await page.keyboard.press('Control+t')
    await expect.poll(async () => await tabs.count(), {
      timeout: 5000,
      message: 'Expected Ctrl+T to create a new tab',
    }).toBe(tabsBefore + 1)
  })

  test('tabs can be switched by clicking', async () => {
    skipIfLaunchUnavailable()

    // This test assumes there are already tabs
    // Look for any tab buttons in the tab bar (uses obsidian theme)
    const tabs = page.locator('[class*="rounded-t-lg"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click the first tab
      await tabs.first().click()
      await page.waitForTimeout(200)

      // Click the second tab
      await tabs.nth(1).click()
      await page.waitForTimeout(200)

      // Should switch without errors
    }
  })

  test('help overlay can be opened with Ctrl+?', async () => {
    skipIfLaunchUnavailable()

    await page.keyboard.press('Control+Shift+/')
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3000 })
  })

  test('Escape closes help overlay', async () => {
    skipIfLaunchUnavailable()

    await page.keyboard.press('Control+Shift+/')
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await expect(page.getByText('Keyboard Shortcuts')).toBeHidden({ timeout: 3000 })
  })
})
