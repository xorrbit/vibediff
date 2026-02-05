import { homedir, platform } from 'os'
import { join, resolve } from 'path'
import { readFile, access } from 'fs/promises'
import { readFileSync } from 'fs'
import { GrammarContribution, GrammarScanResult } from '@shared/types'

function isWSL(): boolean {
  if (platform() !== 'linux') return false
  try {
    return readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

const IS_WSL = isWSL()

interface ExtensionEntry {
  identifier: { id: string }
  location?: { _fsPath?: string; path?: string }
  relativeLocation?: string
}

interface ExtensionGrammar {
  language?: string
  scopeName: string
  path: string
}

interface ExtensionLanguage {
  id: string
  extensions?: string[]
}

interface ExtensionPackageJson {
  contributes?: {
    grammars?: ExtensionGrammar[]
    languages?: ExtensionLanguage[]
  }
}

export class GrammarScanner {
  private cachedResult: GrammarScanResult | null = null
  private cachedWasm: Uint8Array | null | undefined = undefined

  /**
   * Scan VSCode extensions for TextMate grammar files.
   * Results are cached after the first call.
   */
  async scan(): Promise<GrammarScanResult> {
    if (this.cachedResult) return this.cachedResult

    // WSL2 filesystem I/O is too slow — scanning hundreds of extension files
    // and serializing megabytes of grammar content over IPC blocks the main
    // process event loop, freezing all window input. Fall back to Monarch.
    if (IS_WSL) {
      this.cachedResult = { grammars: [], errors: [] }
      return this.cachedResult
    }

    const errors: string[] = []
    const grammars: GrammarContribution[] = []

    const extensionsDir = this.getExtensionsDir()

    if (!(await this.pathExists(extensionsDir))) {
      this.cachedResult = { grammars: [], errors: ['VSCode extensions directory not found'] }
      return this.cachedResult
    }

    // Read extensions.json to find installed extensions
    const extensionsJsonPath = join(extensionsDir, 'extensions.json')
    let extensions: ExtensionEntry[]
    try {
      const raw = await readFile(extensionsJsonPath, 'utf-8')
      extensions = JSON.parse(raw)
      if (!Array.isArray(extensions)) {
        this.cachedResult = { grammars: [], errors: ['extensions.json is not an array'] }
        return this.cachedResult
      }
    } catch (err) {
      this.cachedResult = {
        grammars: [],
        errors: [`Failed to read extensions.json: ${err instanceof Error ? err.message : err}`],
      }
      return this.cachedResult
    }

    // Process each installed extension
    for (const ext of extensions) {
      try {
        const extDir = this.resolveExtensionDir(extensionsDir, ext)
        if (!extDir || !(await this.pathExists(extDir))) continue

        const contributions = await this.loadExtensionGrammars(extDir)
        if (contributions.grammars.length > 0) {
          grammars.push(...contributions.grammars)
        }
        if (contributions.errors.length > 0) {
          errors.push(...contributions.errors)
        }
      } catch (err) {
        errors.push(
          `Error processing extension ${ext.identifier?.id || 'unknown'}: ${err instanceof Error ? err.message : err}`
        )
      }
    }

    this.cachedResult = { grammars, errors }
    return this.cachedResult
  }

  /**
   * Read the onig.wasm binary from node_modules.
   */
  async getOnigWasm(): Promise<Uint8Array | null> {
    if (this.cachedWasm !== undefined) return this.cachedWasm

    // WSL2: skip WASM loading — avoids filesystem I/O and large IPC
    // serialization that can block the main process event loop.
    if (IS_WSL) {
      this.cachedWasm = null
      return null
    }

    const possiblePaths = [
      // Development: relative to src/main/services/
      join(__dirname, '../../../node_modules/vscode-oniguruma/release/onig.wasm'),
      // Production: relative to dist/main/
      join(__dirname, '../../node_modules/vscode-oniguruma/release/onig.wasm'),
      // Packaged app: in app.asar
      join(process.resourcesPath || '', 'node_modules/vscode-oniguruma/release/onig.wasm'),
    ]

    for (const wasmPath of possiblePaths) {
      try {
        const buf = await readFile(wasmPath)
        this.cachedWasm = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        return this.cachedWasm
      } catch {
        continue
      }
    }

    this.cachedWasm = null
    return null
  }

  private getExtensionsDir(): string {
    return join(homedir(), '.vscode', 'extensions')
  }

  private resolveExtensionDir(extensionsDir: string, ext: ExtensionEntry): string | null {
    // Try absolute path from location field
    const absPath = ext.location?._fsPath || ext.location?.path
    if (absPath) return absPath

    // Fall back to relative location
    if (ext.relativeLocation) {
      return join(extensionsDir, ext.relativeLocation)
    }

    return null
  }

  private async loadExtensionGrammars(extDir: string): Promise<{ grammars: GrammarContribution[]; errors: string[] }> {
    const grammars: GrammarContribution[] = []
    const errors: string[] = []

    // Read the extension's package.json
    let pkg: ExtensionPackageJson
    try {
      const raw = await readFile(join(extDir, 'package.json'), 'utf-8')
      pkg = JSON.parse(raw)
    } catch {
      // No package.json or invalid JSON — skip silently
      return { grammars, errors }
    }

    const grammarEntries = pkg.contributes?.grammars
    if (!grammarEntries || grammarEntries.length === 0) {
      return { grammars, errors }
    }

    // Build a map of language ID → file extensions from contributes.languages
    const langExtensions = new Map<string, string[]>()
    for (const lang of pkg.contributes?.languages || []) {
      if (lang.id && lang.extensions) {
        langExtensions.set(lang.id, lang.extensions)
      }
    }

    // Load each grammar
    for (const entry of grammarEntries) {
      if (!entry.scopeName || !entry.path) continue

      // Skip grammars that have no associated language (embedded grammars like regex)
      if (!entry.language) continue

      const grammarPath = resolve(extDir, entry.path)

      try {
        const rawContent = await readFile(grammarPath, 'utf-8')

        grammars.push({
          scopeName: entry.scopeName,
          languageId: entry.language,
          fileExtensions: langExtensions.get(entry.language) || [],
          rawContent,
          grammarPath,
        })
      } catch (err) {
        errors.push(
          `Failed to read grammar ${grammarPath}: ${err instanceof Error ? err.message : err}`
        )
      }
    }

    return { grammars, errors }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await access(p)
      return true
    } catch {
      return false
    }
  }
}
