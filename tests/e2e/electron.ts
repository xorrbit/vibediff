import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { existsSync } from 'fs'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'

let electronApp: ElectronApplication | null = null
let fixtureHomeDir: string | null = null

type FixtureProfile = 'empty-home' | 'git-dirty'

interface LaunchOptions {
  fixture?: FixtureProfile
}

type LaunchResult =
  | { app: ElectronApplication; page: Page }
  | { error: Error }

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  return value !== '0' && value.toLowerCase() !== 'false'
}

function runGit(args: string[], cwd: string): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim() || result.stdout.trim()}`)
  }
}

async function createFixtureHome(profile: FixtureProfile): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'cdw-e2e-home-'))
  await writeFile(join(base, 'README.md'), '# E2E Home Fixture\n')

  if (profile === 'git-dirty') {
    runGit(['init'], base)
    runGit(['config', 'user.email', 'e2e@example.com'], base)
    runGit(['config', 'user.name', 'E2E Fixture'], base)
    await writeFile(join(base, 'changed.ts'), 'export const value = 1\n')
    runGit(['add', 'changed.ts'], base)
    runGit(['commit', '-m', 'initial'], base)
    await writeFile(join(base, 'changed.ts'), 'export const value = 2\n')
    await writeFile(join(base, 'untracked.ts'), 'export const untracked = true\n')
  }

  return base
}

function getLaunchPrereqError(mainPath: string): Error | null {
  if (!isTruthy(process.env.ELECTRON_TEST)) {
    return new Error('Set ELECTRON_TEST=1 to run Electron E2E tests')
  }
  if (!existsSync(mainPath)) {
    return new Error(`Electron build output is missing at ${mainPath}. Run "npm run build" first.`)
  }
  return null
}

export function shouldFailOnMissingPrereqs(): boolean {
  return isTruthy(process.env.CI) || isTruthy(process.env.ELECTRON_E2E_STRICT)
}

export async function launchElectron(options: LaunchOptions = {}): Promise<LaunchResult> {
  const fixture = options.fixture ?? 'empty-home'
  const mainPath = join(__dirname, '../../dist/main/index.js')
  const prereqError = getLaunchPrereqError(mainPath)
  if (prereqError) {
    return { error: prereqError }
  }

  try {
    fixtureHomeDir = await createFixtureHome(fixture)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: new Error(`Failed to prepare E2E fixture (${fixture}): ${message}`) }
  }

  try {
    electronApp = await electron.launch({
      args: ['--no-sandbox', mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: '1',
        HOME: fixtureHomeDir,
        USERPROFILE: fixtureHomeDir,
      },
    })

    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    return { app: electronApp, page }
  } catch (error) {
    await cleanupFixture()
    const message = error instanceof Error ? error.message : String(error)
    return { error: new Error(`Electron launch failed: ${message}`) }
  }
}

async function cleanupFixture(): Promise<void> {
  if (!fixtureHomeDir) return
  const dir = fixtureHomeDir
  fixtureHomeDir = null
  await rm(dir, { recursive: true, force: true })
}

export async function closeElectron(): Promise<void> {
  if (electronApp) {
    await electronApp.close()
    electronApp = null
  }
  await cleanupFixture()
}

export function getElectronApp(): ElectronApplication | null {
  return electronApp
}
