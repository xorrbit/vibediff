import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const { mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}))

vi.mock('os', () => {
  const mod = { homedir: () => '/home/testuser', platform: () => 'darwin' }
  return { ...mod, default: mod }
})

vi.mock('fs', () => {
  const mod = { readFileSync: () => '' }
  return { ...mod, default: mod }
})

vi.mock('fs/promises', () => {
  const mod = { readFile: mockReadFile, access: mockAccess }
  return { ...mod, default: mod }
})

import { GrammarScanner } from '@main/services/grammar-scanner'

const extensionsDir = join('/home/testuser', '.vscode', 'extensions')
const extensionsJsonPath = join(extensionsDir, 'extensions.json')

function makeExtensionsJson(entries: Array<{ id: string; relativeLocation: string }>) {
  return JSON.stringify(
    entries.map((e) => ({
      identifier: { id: e.id },
      relativeLocation: e.relativeLocation,
    }))
  )
}

function makePackageJson(opts: {
  grammars?: Array<{ language?: string; scopeName: string; path: string }>
  languages?: Array<{ id: string; extensions?: string[] }>
}) {
  return JSON.stringify({
    contributes: {
      grammars: opts.grammars || [],
      languages: opts.languages || [],
    },
  })
}

describe('GrammarScanner', () => {
  let scanner: GrammarScanner

  beforeEach(() => {
    vi.clearAllMocks()
    scanner = new GrammarScanner()
  })

  describe('scan', () => {
    it('returns empty result when extensions dir does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'))

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('not found')
    })

    it('returns empty result when extensions.json is missing', async () => {
      mockAccess.mockResolvedValueOnce(undefined)
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('extensions.json')
    })

    it('parses extensions.json and reads grammar contributions', async () => {
      const extDir = join(extensionsDir, 'ext-python')
      const grammarPath = join(extDir, 'syntaxes', 'python.tmLanguage.json')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'ms-python.python', relativeLocation: 'ext-python' }])
        }
        if (path === join(extDir, 'package.json')) {
          return makePackageJson({
            grammars: [{ language: 'python', scopeName: 'source.python', path: 'syntaxes/python.tmLanguage.json' }],
            languages: [{ id: 'python', extensions: ['.py', '.pyw'] }],
          })
        }
        if (path === grammarPath) {
          return '{"scopeName":"source.python","patterns":[]}'
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.errors).toEqual([])
      expect(result.grammars).toHaveLength(1)
      expect(result.grammars[0]).toEqual({
        scopeName: 'source.python',
        languageId: 'python',
        fileExtensions: ['.py', '.pyw'],
        rawContent: '{"scopeName":"source.python","patterns":[]}',
        grammarPath,
      })
    })

    it('skips extensions with no contributes.grammars', async () => {
      const extDir = join(extensionsDir, 'ext-theme')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'some-theme', relativeLocation: 'ext-theme' }])
        }
        if (path === join(extDir, 'package.json')) {
          return JSON.stringify({ contributes: { themes: [] } })
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
      expect(result.errors).toEqual([])
    })

    it('handles malformed package.json', async () => {
      const extDir = join(extensionsDir, 'ext-broken')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'broken-ext', relativeLocation: 'ext-broken' }])
        }
        if (path === join(extDir, 'package.json')) {
          return '{invalid json'
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
    })

    it('handles missing grammar file', async () => {
      const extDir = join(extensionsDir, 'ext-go')
      const grammarPath = join(extDir, 'syntaxes', 'go.tmLanguage.json')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'golang.go', relativeLocation: 'ext-go' }])
        }
        if (path === join(extDir, 'package.json')) {
          return makePackageJson({
            grammars: [{ language: 'go', scopeName: 'source.go', path: 'syntaxes/go.tmLanguage.json' }],
            languages: [{ id: 'go', extensions: ['.go'] }],
          })
        }
        if (path === grammarPath) {
          throw new Error('ENOENT')
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to read grammar')
    })

    it('resolves file extensions from contributes.languages', async () => {
      const extDir = join(extensionsDir, 'ext-ruby')
      const grammarPath = join(extDir, 'syntaxes', 'ruby.tmLanguage.json')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'ruby', relativeLocation: 'ext-ruby' }])
        }
        if (path === join(extDir, 'package.json')) {
          return makePackageJson({
            grammars: [{ language: 'ruby', scopeName: 'source.ruby', path: 'syntaxes/ruby.tmLanguage.json' }],
            languages: [{ id: 'ruby', extensions: ['.rb', '.rake', '.gemspec'] }],
          })
        }
        if (path === grammarPath) {
          return '{}'
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars[0].fileExtensions).toEqual(['.rb', '.rake', '.gemspec'])
    })

    it('rejects grammar paths that escape the extension directory', async () => {
      const extDir = join(extensionsDir, 'ext-malicious')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return makeExtensionsJson([{ id: 'malicious-ext', relativeLocation: 'ext-malicious' }])
        }
        if (path === join(extDir, 'package.json')) {
          return makePackageJson({
            grammars: [{ language: 'python', scopeName: 'source.python', path: '../../../etc/passwd' }],
            languages: [{ id: 'python', extensions: ['.py'] }],
          })
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('escapes extension directory')
    })

    it('caches scan result on second call', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'))

      const result1 = await scanner.scan()
      const result2 = await scanner.scan()

      expect(result1).toBe(result2)
      expect(mockAccess).toHaveBeenCalledTimes(1)
    })

    it('resolves extension dir from location._fsPath', async () => {
      const absPath = '/opt/vscode-extensions/ext-go'
      const grammarPath = join(absPath, 'syntaxes', 'go.tmLanguage.json')

      mockAccess.mockResolvedValue(undefined)
      mockReadFile.mockImplementation(async (path: any) => {
        if (path === extensionsJsonPath) {
          return JSON.stringify([
            {
              identifier: { id: 'golang.go' },
              location: { _fsPath: absPath },
            },
          ])
        }
        if (path === join(absPath, 'package.json')) {
          return makePackageJson({
            grammars: [{ language: 'go', scopeName: 'source.go', path: 'syntaxes/go.tmLanguage.json' }],
            languages: [{ id: 'go', extensions: ['.go'] }],
          })
        }
        if (path === grammarPath) {
          return '{}'
        }
        throw new Error(`Unexpected readFile: ${path}`)
      })

      const result = await scanner.scan()

      expect(result.grammars).toHaveLength(1)
      expect(result.grammars[0].languageId).toBe('go')
    })
  })

  describe('getOnigWasm', () => {
    it('returns wasm binary when file exists', async () => {
      const fakeWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d])
      mockReadFile.mockResolvedValueOnce(fakeWasm)

      const result = await scanner.getOnigWasm()

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result!.length).toBe(4)
    })

    it('returns null when wasm file is not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'))

      const result = await scanner.getOnigWasm()

      expect(result).toBeNull()
    })

    it('caches wasm result on second call', async () => {
      const fakeWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d])
      mockReadFile.mockResolvedValueOnce(fakeWasm)

      const result1 = await scanner.getOnigWasm()
      const result2 = await scanner.getOnigWasm()

      expect(result1).toBe(result2)
      expect(mockReadFile).toHaveBeenCalledTimes(1)
    })
  })
})
