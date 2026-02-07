import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchElectron, closeElectron, shouldFailOnMissingPrereqs } from './electron'

let electronApp: ElectronApplication
let page: Page
let launchError: Error | null = null

test.describe('Diff Panel', () => {
  const skipIfLaunchUnavailable = () => {
    if (launchError || !page) test.skip(launchError?.message || 'Electron launch unavailable')
  }
  test.beforeAll(async () => {
    const launched = await launchElectron({ fixture: 'git-dirty' })
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

  test('diff panel container exists', async () => {
    skipIfLaunchUnavailable()

    await expect(page.getByText('Changes')).toBeVisible({ timeout: 5000 })
  })

  test('shows deterministic changed files from fixture repo', async () => {
    skipIfLaunchUnavailable()

    await expect(page.locator('button[title*="changed.ts"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button[title*="untracked.ts"]')).toBeVisible({ timeout: 10000 })
  })

  test('resizable divider exists', async () => {
    skipIfLaunchUnavailable()

    const divider = page.locator('[class*="cursor-col-resize"]')
    await expect(divider.first()).toBeVisible({ timeout: 10000 })
  })

  test('opens Monaco diff editor when selecting a file', async () => {
    skipIfLaunchUnavailable()

    await page.locator('button[title*="changed.ts"]').first().click()
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 10000 })
  })

  test('divider can be dragged to resize', async () => {
    skipIfLaunchUnavailable()

    const divider = page.locator('[class*="cursor-col-resize"]')
    const panel = page.locator('div[style*="max-height"]').first()

    await expect(divider.first()).toBeVisible({ timeout: 10000 })
    const dividerBox = await divider.first().boundingBox()
    const beforeWidth = await panel.evaluate((el) => (el as HTMLElement).style.width)

    expect(dividerBox).toBeTruthy()
    await page.mouse.move(dividerBox!.x + dividerBox!.width / 2, dividerBox!.y + dividerBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(dividerBox!.x + 80, dividerBox!.y + dividerBox!.height / 2)
    await page.mouse.up()

    await expect.poll(async () => {
      return panel.evaluate((el) => (el as HTMLElement).style.width)
    }, {
      timeout: 5000,
      message: 'Expected file-list panel width style to change after dragging divider',
    }).not.toBe(beforeWidth)
  })
})
