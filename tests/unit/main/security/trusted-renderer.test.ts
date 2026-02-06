import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsPackaged, mockGetAppPath } = vi.hoisted(() => {
  return {
    mockIsPackaged: { value: false },
    mockGetAppPath: vi.fn(() => '/app'),
  }
})

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
    getAppPath: mockGetAppPath,
  },
}))

import { isTrustedRendererUrl } from '@main/security/trusted-renderer'

describe('isTrustedRendererUrl', () => {
  beforeEach(() => {
    mockIsPackaged.value = false
    mockGetAppPath.mockReturnValue('/app')
    delete process.env.VITE_DEV_SERVER_URL
  })

  it('accepts only packaged renderer index file URL', () => {
    expect(isTrustedRendererUrl('file:///app/dist/renderer/index.html')).toBe(true)
    expect(isTrustedRendererUrl('file:///app/dist/renderer/other.html')).toBe(false)
    expect(isTrustedRendererUrl('file:///tmp/evil.html')).toBe(false)
  })

  it('accepts dev URLs only in unpackaged mode', () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
    expect(isTrustedRendererUrl('http://localhost:5173/')).toBe(true)

    mockIsPackaged.value = true
    expect(isTrustedRendererUrl('http://localhost:5173/')).toBe(false)
  })
})
