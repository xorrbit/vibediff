import * as pty from 'node-pty'
import { app } from 'electron'
import { platform } from 'os'
import { existsSync, readlinkSync, lstatSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { detectShell, getShellName } from './shell'
import { debugLog } from '../logger'

const execFileAsync = promisify(execFile)

interface PtyCallbacks {
  onData: (data: string) => void
  onExit: (code: number) => void
  onCwdChanged?: (cwd: string) => void
}

interface PtyInstance {
  pty: pty.IPty
  callbacks: PtyCallbacks
}

interface CwdCache {
  cwd: string
  timestamp: number
}

// Regex to match OSC 7 escape sequences: \e]7;file://hostname/path\a or \e]7;file://hostname/path\e\\
// eslint-disable-next-line no-control-regex -- terminal escape sequences intentionally use control characters
const OSC7_REGEX = /\x1b\]7;file:\/\/[^/]*(\/[^\x07\x1b]*?)(?:\x07|\x1b\\)/

interface ShellIntegration {
  args: string[]
  env: Record<string, string>
}

function getIntegrationDir(): string {
  return join(app.getPath('userData'), 'shell-integration')
}

function ensureShellIntegrationScripts(): void {
  const dir = getIntegrationDir()
  mkdirSync(dir, { recursive: true, mode: 0o700 })

  // Defense-in-depth: reject if the path is a symlink
  const stat = lstatSync(dir)
  if (stat.isSymbolicLink()) {
    throw new Error(`Shell integration directory is a symlink — refusing to write: ${dir}`)
  }

  // Bash integration: source user's .bashrc then set up OSC 7 reporting
  const bashScript = `[ -f ~/.bashrc ] && source ~/.bashrc
__cdw_report_cwd() { printf '\\e]7;file://%s%s\\a' "$HOSTNAME" "$PWD"; }
PROMPT_COMMAND="__cdw_report_cwd\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
`
  writeFileSync(join(dir, 'bash-integration.bash'), bashScript, { mode: 0o600 })

  // Zsh integration: ZDOTDIR trick
  // .zshenv sources user's .zshenv but keeps ZDOTDIR pointing here
  // so that .zshrc is still loaded from the integration dir
  const zshEnv = `_CDW_ORIG_ZDOTDIR="\${CDW_ORIGINAL_ZDOTDIR:-$HOME}"
[ -f "$_CDW_ORIG_ZDOTDIR/.zshenv" ] && source "$_CDW_ORIG_ZDOTDIR/.zshenv"
`
  writeFileSync(join(dir, '.zshenv'), zshEnv, { mode: 0o600 })

  // .zshrc sources user's .zshrc, sets up OSC 7, then restores ZDOTDIR
  const zshRc = `[ -f "\${_CDW_ORIG_ZDOTDIR:-$HOME}/.zshrc" ] && source "\${_CDW_ORIG_ZDOTDIR:-$HOME}/.zshrc"
__cdw_report_cwd() { printf '\\e]7;file://%s%s\\a' "$HOST" "$PWD"; }
precmd_functions+=(__cdw_report_cwd)
if [ -n "$CDW_ORIGINAL_ZDOTDIR" ]; then
  ZDOTDIR="$CDW_ORIGINAL_ZDOTDIR"
else
  unset ZDOTDIR
fi
unset CDW_ORIGINAL_ZDOTDIR _CDW_ORIG_ZDOTDIR
`
  writeFileSync(join(dir, '.zshrc'), zshRc, { mode: 0o600 })
}

function getShellIntegration(shellPath: string): ShellIntegration {
  const name = getShellName(shellPath).toLowerCase()
  const dir = getIntegrationDir()

  switch (name) {
    case 'bash':
      return {
        args: ['--rcfile', join(dir, 'bash-integration.bash')],
        env: {},
      }
    case 'zsh':
      return {
        args: [],
        env: {
          CDW_ORIGINAL_ZDOTDIR: process.env.ZDOTDIR || '',
          ZDOTDIR: dir,
        },
      }
    case 'fish':
      return {
        args: [
          '-C',
          `function __cdw_report_cwd --on-event fish_prompt; printf '\\e]7;file://%s%s\\a' (hostname) "$PWD"; end`,
        ],
        env: {},
      }
    default:
      return { args: [], env: {} }
  }
}

export class PtyManager {
  private instances: Map<string, PtyInstance> = new Map()
  // Cache CWD results to avoid repeated lsof calls
  private cwdCache: Map<string, CwdCache> = new Map()
  private static CWD_CACHE_TTL = 2000 // 2 seconds
  private integrationReady = false

  private ensureIntegration(): void {
    if (this.integrationReady) return
    try {
      ensureShellIntegrationScripts()
      this.integrationReady = true
    } catch (err) {
      console.error('Failed to write shell integration scripts:', err)
    }
  }

  /**
   * Spawn a new PTY for a session.
   */
  spawn(
    sessionId: string,
    cwd: string,
    shell?: string,
    callbacks?: PtyCallbacks
  ): void {
    // Kill any existing PTY for this session
    this.kill(sessionId)

    const shellInfo = shell ? { path: shell, name: shell } : detectShell()
    const isWindows = platform() === 'win32'
    debugLog('Spawning PTY:', { sessionId, cwd, shell: shellInfo.path })

    // Validate cwd exists
    if (!existsSync(cwd)) {
      throw new Error(`Directory does not exist: ${cwd}`)
    }

    // Set up shell integration for OSC 7 CWD reporting
    this.ensureIntegration()
    const integration = this.integrationReady
      ? getShellIntegration(shellInfo.path)
      : { args: [] as string[], env: {} as Record<string, string> }

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shellInfo.path, integration.args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          ...integration.env,
        },
        useConpty: isWindows,
      })
    } catch (err) {
      console.error('node-pty spawn failed:', err)
      throw new Error(`Failed to spawn shell: ${err instanceof Error ? err.message : err}`)
    }

    const instance: PtyInstance = {
      pty: ptyProcess,
      callbacks: callbacks || { onData: () => {}, onExit: () => {} },
    }

    // Set up event handlers
    ptyProcess.onData((data) => {
      // Parse OSC 7 escape sequences for instant CWD detection
      // TODO: buffer partial sequences split across chunks (extremely rare for short OSC 7)
      const match = data.match(OSC7_REGEX)
      if (match) {
        try {
          const newCwd = decodeURIComponent(match[1])
          this.cwdCache.set(sessionId, { cwd: newCwd, timestamp: Date.now() })
          instance.callbacks.onCwdChanged?.(newCwd)
        } catch {
          // Ignore malformed URIs
        }
      }
      instance.callbacks.onData(data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      instance.callbacks.onExit(exitCode)
      this.instances.delete(sessionId)
      this.cwdCache.delete(sessionId)
    })

    this.instances.set(sessionId, instance)
  }

  /**
   * Write data to a PTY.
   */
  write(sessionId: string, data: string): void {
    const instance = this.instances.get(sessionId)
    if (instance) {
      instance.pty.write(data)
    }
  }

  /**
   * Resize a PTY.
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const instance = this.instances.get(sessionId)
    if (instance) {
      instance.pty.resize(cols, rows)
    }
  }

  /**
   * Kill a PTY and clean up.
   */
  kill(sessionId: string): void {
    const instance = this.instances.get(sessionId)
    if (instance) {
      instance.pty.kill()
      this.instances.delete(sessionId)
      this.cwdCache.delete(sessionId)
    }
  }

  /**
   * Kill all PTYs (for cleanup on app exit).
   */
  killAll(): void {
    for (const [sessionId] of this.instances) {
      this.kill(sessionId)
    }
  }

  /**
   * Get the current working directory of a PTY process.
   * Results are cached briefly to avoid repeated system calls.
   */
  async getCwd(sessionId: string): Promise<string | null> {
    const instance = this.instances.get(sessionId)
    if (!instance) return null

    const pid = instance.pty.pid
    if (!pid) return null

    // Check cache first
    const cached = this.cwdCache.get(sessionId)
    if (cached && Date.now() - cached.timestamp < PtyManager.CWD_CACHE_TTL) {
      return cached.cwd
    }

    let cwd: string | null = null

    // On Linux, read the cwd from /proc/<pid>/cwd (fast, sync is fine)
    if (platform() === 'linux') {
      try {
        cwd = readlinkSync(`/proc/${pid}/cwd`)
      } catch {
        return null
      }
    }

    // On macOS, use lsof to get the cwd (async to avoid blocking main thread)
    if (platform() === 'darwin') {
      try {
        // -a = AND conditions, -d cwd = only cwd file descriptor, -p = process ID
        // -F n = output format with 'n' prefix for name field
        const { stdout } = await execFileAsync(
          'lsof',
          ['-a', '-d', 'cwd', '-p', String(pid), '-F', 'n'],
          { timeout: 1000 }
        )
        // Output format: "p<pid>\nn<path>\n" - extract line starting with 'n'
        const match = stdout.match(/^n(.+)$/m)
        cwd = match ? match[1] : null
      } catch {
        return null
      }
    }

    // Windows: no reliable way to query another process's CWD without native
    // code (NtQueryInformationProcess) or shell integration escape sequences.
    // Returns null, so callers fall back to the initial session cwd.

    // Cache the result
    if (cwd) {
      this.cwdCache.set(sessionId, { cwd, timestamp: Date.now() })
    }

    return cwd
  }
}
