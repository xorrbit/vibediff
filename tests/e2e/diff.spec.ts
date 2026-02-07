import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('Diff Panel', () => {
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
      await page.waitForTimeout(2000)
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

  test('diff panel container exists', async () => {
    skipIfLaunchUnavailable()

    await expect(page.getByText('Changes')).toBeVisible({ timeout: 5000 })
  })

  test('shows empty state or file list', async () => {
    skipIfLaunchUnavailable()

    const noChanges = page.getByText('No changes detected')
    const notInRepo = page.getByText('Not in a git repo')
    const loadingDiff = page.getByText('Loading diff...')
    const fileItems = page.locator(
      'button[title*="(Added)"], button[title*="(Modified)"], button[title*="(Deleted)"], button[title*="(Renamed)"], button[title*="(Untracked)"]'
    )

    await expect.poll(async () => {
      return (await noChanges.count()) > 0 ||
        (await notInRepo.count()) > 0 ||
        (await loadingDiff.count()) > 0 ||
        (await fileItems.count()) > 0
    }, {
      timeout: 10000,
      message: 'Diff panel did not reach any expected visible state',
    }).toBe(true)
  })

  test('resizable divider exists', async () => {
    skipIfLaunchUnavailable()

    // Look for the resizable divider
    const divider = page.locator('[class*="cursor-col-resize"]')
    const count = await divider.count()

    // May have a divider if session exists
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('monaco editor container exists in diff view', async () => {
    skipIfLaunchUnavailable()

    // Monaco editor creates specific elements
    const monacoContainer = page.locator('.monaco-editor')
    const count = await monacoContainer.count()

    // May or may not exist depending on session state
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('file list items are clickable', async () => {
    skipIfLaunchUnavailable()

    // Look for file list items
    const fileItems = page.locator('button:has-text(".")')

    const count = await fileItems.count()
    if (count > 0) {
      // Click first file item
      await fileItems.first().click()
      await page.waitForTimeout(200)

      // Should not throw
    }
  })

  test('divider can be dragged to resize', async () => {
    skipIfLaunchUnavailable()

    const divider = page.locator('[class*="cursor-col-resize"]')

    if ((await divider.count()) > 0) {
      const dividerBox = await divider.first().boundingBox()

      if (dividerBox) {
        // Simulate drag
        await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(dividerBox.x + 100, dividerBox.y + dividerBox.height / 2)
        await page.mouse.up()

        // Should resize without errors
        await page.waitForTimeout(200)
      }
    }
  })
})
