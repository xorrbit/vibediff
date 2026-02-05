import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  pty: {
    spawn: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(() => () => {}),
    onExit: vi.fn(() => () => {}),
  },
  git: {
    getChangedFiles: vi.fn(),
    getFileDiff: vi.fn(),
    getFileContent: vi.fn(),
    getMainBranch: vi.fn(),
  },
  fs: {
    selectDirectory: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    onFileChange: vi.fn(() => () => {}),
  },
  menu: {
    onNewTab: vi.fn(() => () => {}),
    onCloseTab: vi.fn(() => () => {}),
    onShowHelp: vi.fn(() => () => {}),
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
