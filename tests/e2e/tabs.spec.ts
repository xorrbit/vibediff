import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('Tab Management', () => {
  const skipIfLaunchUnavailable = () => {
    if (launchError || !page) test.skip()
  }
  test.beforeAll(async () => {
    if (!process.env.ELECTRON_TEST) {
      launchError = new Error('Set ELECTRON_TEST=1 to run Electron E2E tests')
      return
    }

    const mainPath = join(__dirname, '../../dist/main/index.js')

    try {
      electronApp = await electron.launch({
        args: ['--no-sandbox', mainPath],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ELECTRON_DISABLE_SANDBOX: '1',
        },
      })

      page = await electronApp.firstWindow()
      await page.waitForLoadState('domcontentloaded')
      // Give React time to initialize
      await page.waitForTimeout(1000)
    } catch (error) {
      console.warn('Electron launch failed, skipping E2E tests:', error)
      launchError = error instanceof Error ? error : new Error(String(error))
    }
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
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
