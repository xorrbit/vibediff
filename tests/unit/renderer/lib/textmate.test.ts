import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GrammarScanResult } from '@shared/types'

const {
  mockLoadWASM,
  mockLoadGrammar,
  mockSetTokensProvider,
  mockRegisterLanguage,
  mockGetLanguages,
} = vi.hoisted(() => ({
  mockLoadWASM: vi.fn(),
  mockLoadGrammar: vi.fn(),
  mockSetTokensProvider: vi.fn(),
  mockRegisterLanguage: vi.fn(),
  mockGetLanguages: vi.fn().mockReturnValue([]),
}))

vi.mock('monaco-editor', () => ({
  languages: {
    setTokensProvider: mockSetTokensProvider,
    register: mockRegisterLanguage,
    getLanguages: mockGetLanguages,
  },
}))

vi.mock('vscode-oniguruma', () => ({
  loadWASM: mockLoadWASM,
  createOnigScanner: vi.fn(),
  createOnigString: vi.fn(),
}))

vi.mock('vscode-textmate', () => ({
  Registry: vi.fn().mockImplementation(() => ({
    loadGrammar: mockLoadGrammar,
  })),
  parseRawGrammar: vi.fn(),
  INITIAL: { clone: vi.fn(), equals: vi.fn() },
}))

function makeGrammarScanResult(
  grammars: GrammarScanResult['grammars'] = [],
  errors: string[] = [],
): GrammarScanResult {
  return { grammars, errors }
}

function makeGrammar(opts: Partial<GrammarScanResult['grammars'][0]> = {}) {
  return {
    scopeName: opts.scopeName ?? 'source.go',
    languageId: opts.languageId ?? 'go',
    fileExtensions: opts.fileExtensions ?? ['.go'],
    rawContent: opts.rawContent ?? '{}',
    grammarPath: opts.grammarPath ?? '/ext/go.tmLanguage.json',
  }
}

describe('TextMateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetLanguages.mockReturnValue([])
  })

  async function getService() {
    const mod = await import('@renderer/lib/textmate')
    return mod.textMateService
  }

  function mockGrammarAPI(opts: {
    wasmBinary?: Uint8Array | null
    scanResult?: GrammarScanResult
  }) {
    const wasm = opts.wasmBinary !== undefined ? opts.wasmBinary : null
    const scan = opts.scanResult || makeGrammarScanResult()
    ;(window.electronAPI as any).grammar = {
      getOnigWasm: vi.fn().mockResolvedValue(wasm),
      scan: vi.fn().mockResolvedValue(scan),
    }
  }

  it('initializes successfully with valid grammars', async () => {
    const fakeWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d])
    mockGrammarAPI({
      wasmBinary: fakeWasm,
      scanResult: makeGrammarScanResult([makeGrammar()]),
    })
    mockLoadGrammar.mockResolvedValue({
      tokenizeLine: vi.fn().mockReturnValue({
        tokens: [{ startIndex: 0, scopes: ['source.go'] }],
        ruleStack: { clone: vi.fn(), equals: vi.fn() },
      }),
    })

    const service = await getService()
    await service.initialize()

    expect(mockLoadWASM).toHaveBeenCalledTimes(1)
    expect(mockSetTokensProvider).toHaveBeenCalledTimes(1)
    expect(mockSetTokensProvider).toHaveBeenCalledWith('go', expect.any(Object))
    expect(service.hasGrammar('go')).toBe(true)
  })

  it('gracefully handles null onig.wasm', async () => {
    mockGrammarAPI({ wasmBinary: null })

    const service = await getService()
    await service.initialize()

    expect(mockLoadWASM).not.toHaveBeenCalled()
    expect(mockSetTokensProvider).not.toHaveBeenCalled()
    expect(service.hasGrammar('go')).toBe(false)
  })

  it('gracefully handles empty grammars', async () => {
    const fakeWasm = new Uint8Array([0x00])
    mockGrammarAPI({
      wasmBinary: fakeWasm,
      scanResult: makeGrammarScanResult(),
    })

    const service = await getService()
    await service.initialize()

    expect(mockLoadWASM).toHaveBeenCalledTimes(1)
    expect(mockSetTokensProvider).not.toHaveBeenCalled()
  })

  it('getLanguageForFile returns correct language', async () => {
    const fakeWasm = new Uint8Array([0x00])
    mockGrammarAPI({
      wasmBinary: fakeWasm,
      scanResult: makeGrammarScanResult([
        makeGrammar({ languageId: 'go', fileExtensions: ['.go'] }),
        makeGrammar({
          scopeName: 'source.python',
          languageId: 'python',
          fileExtensions: ['.py', '.pyw'],
          grammarPath: '/ext/python.tmLanguage.json',
        }),
      ]),
    })
    mockLoadGrammar.mockResolvedValue({ tokenizeLine: vi.fn() })

    const service = await getService()
    await service.initialize()

    expect(service.getLanguageForFile('main.go')).toBe('go')
    expect(service.getLanguageForFile('script.py')).toBe('python')
    expect(service.getLanguageForFile('lib.pyw')).toBe('python')
  })

  it('getLanguageForFile returns null for unknown extensions', async () => {
    const fakeWasm = new Uint8Array([0x00])
    mockGrammarAPI({
      wasmBinary: fakeWasm,
      scanResult: makeGrammarScanResult([makeGrammar()]),
    })
    mockLoadGrammar.mockResolvedValue({ tokenizeLine: vi.fn() })

    const service = await getService()
    await service.initialize()

    expect(service.getLanguageForFile('main.rs')).toBeNull()
    expect(service.getLanguageForFile('noext')).toBeNull()
  })

  it('handles initialization failure gracefully', async () => {
    const fakeWasm = new Uint8Array([0x00])
    mockGrammarAPI({ wasmBinary: fakeWasm })
    mockLoadWASM.mockRejectedValueOnce(new Error('WASM load failed'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const service = await getService()
    await service.initialize()

    expect(warnSpy).toHaveBeenCalledWith(
      'TextMate initialization failed:',
      expect.any(Error),
    )
    expect(service.hasGrammar('go')).toBe(false)
    expect(mockSetTokensProvider).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('initialize is idempotent', async () => {
    const fakeWasm = new Uint8Array([0x00])
    mockGrammarAPI({
      wasmBinary: fakeWasm,
      scanResult: makeGrammarScanResult(),
    })

    const service = await getService()
    await service.initialize()
    await service.initialize()

    expect(mockLoadWASM).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.grammar.scan).toHaveBeenCalledTimes(1)
  })
})
