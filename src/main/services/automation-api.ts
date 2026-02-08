import { randomBytes, timingSafeEqual } from 'crypto'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { isAbsolute, join, resolve } from 'path'
import { isPathInside } from '../security/path-utils'
import { debugLog } from '../logger'

const AUTOMATION_DIR_NAME = 'automation'
const CONFIG_FILENAME = 'config.json'
const CREDENTIALS_FILENAME = 'credentials.json'
const API_PATH = '/v1/terminal/bootstrap'

const MIN_LIMIT = 1
const MAX_REQUEST_TIMEOUT_MS = 120_000
const MAX_ALLOWED_COMMANDS = 200
const MAX_ALLOWED_COMMAND_LENGTH = 16_384
const MAX_ALLOWED_REQUEST_BYTES = 2 * 1024 * 1024
const MAX_RATE_LIMIT_PER_MINUTE = 1000

interface RateLimitState {
  windowStartedAt: number
  count: number
}

class HttpError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export interface AutomationBootstrapCommandRequest {
  cwd: string
  commands: string[]
}

export interface AutomationBootstrapCommandResponse {
  sessionId: string
}

export interface AutomationApiConfig {
  version: 1
  enabled: boolean
  allowedRoots: string[]
  maxCommands: number
  maxCommandLength: number
  maxRequestBytes: number
  requestTimeoutMs: number
  rateLimitPerMinute: number
}

export interface AutomationApiCredentials {
  version: 1
  host: '127.0.0.1'
  port: number
  token: string
  createdAt: string
}

export interface AutomationApiStatus {
  enabled: boolean
}

const DEFAULT_AUTOMATION_CONFIG: AutomationApiConfig = {
  version: 1,
  enabled: false,
  allowedRoots: [],
  maxCommands: 25,
  maxCommandLength: 4096,
  maxRequestBytes: 256 * 1024,
  requestTimeoutMs: 20_000,
  rateLimitPerMinute: 60,
}

function isLocalAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertKnownKeys(obj: Record<string, unknown>, allowedKeys: string[], name: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${name} contains unknown key: ${key}`)
    }
  }
}

function parsePositiveInt(
  value: unknown,
  name: string,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`)
  }
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`)
  }
  return value
}

export class AutomationApiService {
  private server: Server | null = null
  private credentials: AutomationApiCredentials | null = null
  private config: AutomationApiConfig = DEFAULT_AUTOMATION_CONFIG
  private readonly rateLimitByAddress = new Map<string, RateLimitState>()

  constructor(
    private readonly userDataDir: string,
    private readonly onBootstrap: (request: AutomationBootstrapCommandRequest) => Promise<AutomationBootstrapCommandResponse>
  ) {}

  getConfigPath(): string {
    return join(this.getAutomationDir(), CONFIG_FILENAME)
  }

  getCredentialsPath(): string {
    return join(this.getAutomationDir(), CREDENTIALS_FILENAME)
  }

  getCredentials(): AutomationApiCredentials | null {
    return this.credentials
  }

  getStatus(): AutomationApiStatus {
    return {
      enabled: this.config.enabled && this.credentials !== null,
    }
  }

  async start(): Promise<void> {
    this.config = this.loadOrCreateConfig()

    if (!this.config.enabled) {
      this.credentials = null
      this.removeCredentialsFile()
      debugLog('Automation API is disabled')
      return
    }

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const server = this.server!
      server.once('error', rejectPromise)
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', rejectPromise)
        resolvePromise()
      })
    })

    const address = this.server.address()
    if (!address || typeof address === 'string') {
      await this.stop()
      throw new Error('Automation API failed to acquire a TCP port')
    }

    this.credentials = {
      version: 1,
      host: '127.0.0.1',
      port: address.port,
      token: randomBytes(32).toString('base64url'),
      createdAt: new Date().toISOString(),
    }
    this.writeCredentials(this.credentials)
    debugLog('Automation API listening', {
      host: this.credentials.host,
      port: this.credentials.port,
    })
  }

  async setEnabled(enabled: boolean): Promise<AutomationApiStatus> {
    if (enabled === this.getStatus().enabled) {
      return this.getStatus()
    }

    // Update config on disk
    this.config = { ...this.config, enabled }
    this.ensureAutomationDir()
    this.writeJsonFileAtomic(this.getConfigPath(), this.config)

    if (enabled) {
      await this.start()
    } else {
      await this.stop()
    }

    return this.getStatus()
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null
    this.rateLimitByAddress.clear()

    if (server) {
      await new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise())
      })
    }

    this.credentials = null
    this.removeCredentialsFile()
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (!this.credentials || !this.server) {
        throw new HttpError(503, 'Automation API is unavailable')
      }

      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
      if (requestUrl.pathname !== API_PATH) {
        throw new HttpError(404, 'Not found')
      }
      if (req.method !== 'POST') {
        throw new HttpError(405, 'Method not allowed')
      }
      if (!isLocalAddress(req.socket.remoteAddress)) {
        throw new HttpError(403, 'Forbidden')
      }

      this.assertNonBrowserRequest(req)
      this.assertAuthentication(req)
      this.assertRateLimit(req)
      this.assertContentType(req)

      const payload = await this.readAndValidatePayload(req)
      const result = await this.executeWithTimeout(payload, this.config.requestTimeoutMs)

      this.writeJson(res, 201, {
        sessionId: result.sessionId,
      })
    } catch (error) {
      if (error instanceof HttpError) {
        this.writeJson(res, error.statusCode, { error: error.message })
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error'
        this.writeJson(res, 500, { error: message })
      }
    }
  }

  private assertNonBrowserRequest(req: IncomingMessage): void {
    if (req.headers.origin) {
      throw new HttpError(403, 'Origin header is not allowed')
    }
    if (req.headers['sec-fetch-site'] || req.headers['sec-fetch-mode'] || req.headers['sec-fetch-dest']) {
      throw new HttpError(403, 'Browser requests are not allowed')
    }
    const clientHeader = req.headers['x-cdw-client']
    if (typeof clientHeader !== 'string' || clientHeader.trim().length === 0 || clientHeader.length > 128) {
      throw new HttpError(400, 'Missing or invalid X-CDW-Client header')
    }
  }

  private assertAuthentication(req: IncomingMessage): void {
    if (!this.credentials) {
      throw new HttpError(503, 'Automation API is unavailable')
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing bearer token')
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (token.length === 0) {
      throw new HttpError(401, 'Missing bearer token')
    }

    const expected = Buffer.from(this.credentials.token, 'utf8')
    const received = Buffer.from(token, 'utf8')

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new HttpError(401, 'Invalid bearer token')
    }
  }

  private assertRateLimit(req: IncomingMessage): void {
    const key = req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const windowMs = 60_000

    const state = this.rateLimitByAddress.get(key)
    if (!state || now - state.windowStartedAt >= windowMs) {
      this.rateLimitByAddress.set(key, { windowStartedAt: now, count: 1 })
      return
    }

    if (state.count >= this.config.rateLimitPerMinute) {
      throw new HttpError(429, 'Rate limit exceeded')
    }

    state.count += 1
    this.rateLimitByAddress.set(key, state)
  }

  private assertContentType(req: IncomingMessage): void {
    const contentType = req.headers['content-type']
    if (typeof contentType !== 'string') {
      throw new HttpError(415, 'Content-Type must be application/json')
    }
    const normalized = contentType.toLowerCase()
    if (!normalized.startsWith('application/json')) {
      throw new HttpError(415, 'Content-Type must be application/json')
    }
  }

  private async readAndValidatePayload(req: IncomingMessage): Promise<AutomationBootstrapCommandRequest> {
    const body = await this.readBody(req, this.config.maxRequestBytes)
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON')
    }

    if (!isObject(parsed)) {
      throw new HttpError(400, 'Request body must be a JSON object')
    }
    assertKnownKeys(parsed, ['cwd', 'commands'], 'request body')

    const cwd = parsed.cwd
    if (typeof cwd !== 'string' || cwd.trim().length === 0) {
      throw new HttpError(400, 'cwd must be a non-empty string')
    }
    if (!isAbsolute(cwd)) {
      throw new HttpError(400, 'cwd must be an absolute path')
    }

    const resolvedCwd = resolve(cwd)
    this.assertPathAllowed(resolvedCwd)

    if (!existsSync(resolvedCwd)) {
      throw new HttpError(400, 'cwd does not exist')
    }
    const cwdStat = lstatSync(resolvedCwd)
    if (!cwdStat.isDirectory()) {
      throw new HttpError(400, 'cwd must be a directory')
    }

    const commands = parsed.commands
    if (!Array.isArray(commands)) {
      throw new HttpError(400, 'commands must be an array of strings')
    }
    if (commands.length === 0 || commands.length > this.config.maxCommands) {
      throw new HttpError(400, `commands must contain between 1 and ${this.config.maxCommands} items`)
    }

    const validatedCommands: string[] = []
    for (const command of commands) {
      if (typeof command !== 'string') {
        throw new HttpError(400, 'commands must contain only strings')
      }
      if (command.trim().length === 0) {
        throw new HttpError(400, 'commands must not contain empty strings')
      }
      if (command.length > this.config.maxCommandLength) {
        throw new HttpError(400, `command length exceeds ${this.config.maxCommandLength}`)
      }
      validatedCommands.push(command)
    }

    return {
      cwd: resolvedCwd,
      commands: validatedCommands,
    }
  }

  private async executeWithTimeout(
    payload: AutomationBootstrapCommandRequest,
    timeoutMs: number
  ): Promise<AutomationBootstrapCommandResponse> {
    let timeout: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutPromise = new Promise<AutomationBootstrapCommandResponse>((_, rejectPromise) => {
        timeout = setTimeout(() => {
          rejectPromise(new HttpError(504, 'Bootstrap request timed out'))
        }, timeoutMs)
        timeout.unref()
      })

      return await Promise.race([
        this.onBootstrap(payload),
        timeoutPromise,
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }

  private assertPathAllowed(resolvedPath: string): void {
    if (this.config.allowedRoots.length === 0) {
      throw new HttpError(503, 'Automation API is enabled without allowedRoots')
    }

    const allowed = this.config.allowedRoots.some((root) => isPathInside(root, resolvedPath))
    if (!allowed) {
      throw new HttpError(403, 'cwd is outside allowedRoots')
    }
  }

  private async readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
    return new Promise<string>((resolvePromise, rejectPromise) => {
      const chunks: Buffer[] = []
      let totalBytes = 0
      let failed = false

      req.on('data', (chunk: Buffer) => {
        if (failed) return
        totalBytes += chunk.length
        if (totalBytes > maxBytes) {
          failed = true
          rejectPromise(new HttpError(413, `Request body exceeds ${maxBytes} bytes`))
          return
        }
        chunks.push(chunk)
      })

      req.on('end', () => {
        if (failed) return
        resolvePromise(Buffer.concat(chunks).toString('utf8'))
      })

      req.on('error', (error) => {
        if (failed) return
        failed = true
        rejectPromise(error)
      })
    })
  }

  private loadOrCreateConfig(): AutomationApiConfig {
    const configPath = this.getConfigPath()
    this.ensureAutomationDir()
    this.assertPathNotSymlink(configPath)

    if (!existsSync(configPath)) {
      this.writeJsonFileAtomic(configPath, DEFAULT_AUTOMATION_CONFIG)
      return DEFAULT_AUTOMATION_CONFIG
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(configPath, 'utf8'))
    } catch (error) {
      throw new Error(`Failed to parse automation config: ${error instanceof Error ? error.message : error}`)
    }

    return this.validateConfig(parsed)
  }

  private validateConfig(raw: unknown): AutomationApiConfig {
    if (!isObject(raw)) {
      throw new Error('Automation config must be a JSON object')
    }

    assertKnownKeys(
      raw,
      [
        'version',
        'enabled',
        'allowedRoots',
        'maxCommands',
        'maxCommandLength',
        'maxRequestBytes',
        'requestTimeoutMs',
        'rateLimitPerMinute',
      ],
      'automation config'
    )

    if (raw.version !== 1) {
      throw new Error('automation config version must be 1')
    }
    if (typeof raw.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean')
    }
    if (!Array.isArray(raw.allowedRoots)) {
      throw new Error('allowedRoots must be an array')
    }

    const allowedRoots = raw.allowedRoots.map((root) => {
      if (typeof root !== 'string' || root.trim().length === 0) {
        throw new Error('allowedRoots entries must be non-empty strings')
      }
      if (!isAbsolute(root)) {
        throw new Error(`allowedRoots entry must be an absolute path: ${root}`)
      }
      return resolve(root)
    })

    const uniqueAllowedRoots = [...new Set(allowedRoots)]

    const config: AutomationApiConfig = {
      version: 1,
      enabled: raw.enabled,
      allowedRoots: uniqueAllowedRoots,
      maxCommands: parsePositiveInt(raw.maxCommands, 'maxCommands', MIN_LIMIT, MAX_ALLOWED_COMMANDS),
      maxCommandLength: parsePositiveInt(raw.maxCommandLength, 'maxCommandLength', MIN_LIMIT, MAX_ALLOWED_COMMAND_LENGTH),
      maxRequestBytes: parsePositiveInt(raw.maxRequestBytes, 'maxRequestBytes', MIN_LIMIT, MAX_ALLOWED_REQUEST_BYTES),
      requestTimeoutMs: parsePositiveInt(raw.requestTimeoutMs, 'requestTimeoutMs', MIN_LIMIT, MAX_REQUEST_TIMEOUT_MS),
      rateLimitPerMinute: parsePositiveInt(raw.rateLimitPerMinute, 'rateLimitPerMinute', MIN_LIMIT, MAX_RATE_LIMIT_PER_MINUTE),
    }

    if (config.enabled && config.allowedRoots.length === 0) {
      throw new Error('allowedRoots must contain at least one path when enabled=true')
    }

    return config
  }

  private ensureAutomationDir(): void {
    const dir = this.getAutomationDir()
    mkdirSync(dir, { recursive: true, mode: 0o700 })

    const stat = lstatSync(dir)
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to use symlink for automation directory: ${dir}`)
    }
    if (!stat.isDirectory()) {
      throw new Error(`Automation path is not a directory: ${dir}`)
    }
  }

  private getAutomationDir(): string {
    return join(this.userDataDir, AUTOMATION_DIR_NAME)
  }

  private writeCredentials(credentials: AutomationApiCredentials): void {
    this.ensureAutomationDir()
    this.writeJsonFileAtomic(this.getCredentialsPath(), credentials)
  }

  private removeCredentialsFile(): void {
    const credentialsPath = this.getCredentialsPath()
    this.assertPathNotSymlink(credentialsPath)
    if (existsSync(credentialsPath)) {
      rmSync(credentialsPath)
    }
  }

  private assertPathNotSymlink(path: string): void {
    if (!existsSync(path)) return
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to use symlink path: ${path}`)
    }
  }

  private writeJsonFileAtomic(path: string, value: unknown): void {
    const payload = `${JSON.stringify(value, null, 2)}\n`
    const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`
    this.assertPathNotSymlink(path)
    this.assertPathNotSymlink(tempPath)

    writeFileSync(tempPath, payload, {
      mode: 0o600,
      flag: 'wx',
    })
    renameSync(tempPath, path)
  }

  private writeJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
    const body = `${JSON.stringify(payload)}\n`
    res.writeHead(statusCode, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(body)
  }
}
