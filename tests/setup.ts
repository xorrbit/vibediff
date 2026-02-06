import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock monaco-editor before any component imports it
vi.mock('monaco-editor', () => ({}))

vi.mock('@monaco-editor/react', () => ({
  loader: {
    config: vi.fn(),
  },
  DiffEditor: vi.fn(({ language }: { language: string }) => {
    const React = require('react')
    return React.createElement('div', {
      'data-testid': 'mock-diff-editor',
      'data-language': language,
    }, 'Mock Diff Editor')
  }),
}))

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  pty: {
    spawn: vi.fn().mockResolvedValue(undefined),
    input: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(() => () => {}),
    onExit: vi.fn(() => () => {}),
    getCwd: vi.fn().mockResolvedValue(null),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
  git: {
    getChangedFiles: vi.fn(),
    getFileDiff: vi.fn(),
    getFileContent: vi.fn(),
    getMainBranch: vi.fn(),
    getCurrentBranch: vi.fn().mockResolvedValue(null),
    findGitRoot: vi.fn().mockResolvedValue(null),
  },
  fs: {
    selectDirectory: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    onFileChange: vi.fn(() => () => {}),
    getHomeDir: vi.fn().mockResolvedValue('/home/test'),
  },
  menu: {
    onNewTab: vi.fn(() => () => {}),
    onCloseTab: vi.fn(() => () => {}),
    onShowHelp: vi.fn(() => () => {}),
  },
  grammar: {
    scan: vi.fn().mockResolvedValue({ grammars: [], errors: [] }),
    getOnigWasm: vi.fn().mockResolvedValue(null),
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    quit: vi.fn(),
  },
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
