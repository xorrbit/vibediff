import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GRAMMAR_CHANNELS } from '@shared/types'

const { mockValidateIpcSender, mockScan, mockGetOnigWasm } = vi.hoisted(() => ({
  mockValidateIpcSender: vi.fn(() => true),
  mockScan: vi.fn(),
  mockGetOnigWasm: vi.fn(),
}))

vi.mock('@main/security/validate-sender', () => ({
  validateIpcSender: mockValidateIpcSender,
}))

vi.mock('@main/services/grammar-scanner', () => ({
  GrammarScanner: vi.fn(function MockGrammarScanner(this: any) {
    this.scan = mockScan
    this.getOnigWasm = mockGetOnigWasm
  }),
}))

import { registerGrammarHandlers } from '@main/ipc/grammar'

function createIpcMainMock() {
  const handles = new Map<string, (...args: any[]) => any>()
  return {
    handles,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        handles.set(channel, handler)
      }),
    } as any,
  }
}

describe('registerGrammarHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateIpcSender.mockReturnValue(true)
  })

  it('rejects unauthorized sender for grammar channels', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerGrammarHandlers(ipcMain)
    mockValidateIpcSender.mockReturnValue(false)

    await expect(handles.get(GRAMMAR_CHANNELS.SCAN)!({ sender: {} })).rejects.toThrow('Unauthorized IPC sender')
    await expect(handles.get(GRAMMAR_CHANNELS.GET_ONIG_WASM)!({ sender: {} })).rejects.toThrow('Unauthorized IPC sender')

    expect(mockScan).not.toHaveBeenCalled()
    expect(mockGetOnigWasm).not.toHaveBeenCalled()
  })

  it('routes valid requests to GrammarScanner methods', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerGrammarHandlers(ipcMain)

    mockScan.mockResolvedValue({ grammars: [], errors: [] })
    mockGetOnigWasm.mockResolvedValue(new Uint8Array([1, 2, 3]))

    await expect(handles.get(GRAMMAR_CHANNELS.SCAN)!({ sender: {} })).resolves.toEqual({ grammars: [], errors: [] })
    await expect(handles.get(GRAMMAR_CHANNELS.GET_ONIG_WASM)!({ sender: {} })).resolves.toEqual(new Uint8Array([1, 2, 3]))

    expect(mockScan).toHaveBeenCalledTimes(1)
    expect(mockGetOnigWasm).toHaveBeenCalledTimes(1)
  })
})
