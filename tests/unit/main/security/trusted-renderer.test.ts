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

import {
  isTrustedDevServerUrl,
  isTrustedRendererFileUrl,
  isTrustedRendererUrl,
} from '@main/security/trusted-renderer'

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

  it('enforces dev server pathname prefix rules', () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173/app/'

    expect(isTrustedDevServerUrl('http://localhost:5173/app/')).toBe(true)
    expect(isTrustedDevServerUrl('http://localhost:5173/app/src/main.tsx')).toBe(true)
    expect(isTrustedDevServerUrl('http://localhost:5173/application')).toBe(false)
  })

  it('rejects invalid URLs and malformed dev-server env values', () => {
    process.env.VITE_DEV_SERVER_URL = 'not-a-url'
    expect(isTrustedDevServerUrl('http://localhost:5173/')).toBe(false)
    expect(isTrustedRendererUrl('not a url')).toBe(false)
  })

  it('enforces strict file:// entrypoint matching', () => {
    expect(isTrustedRendererFileUrl('file:///app/dist/renderer/index.html')).toBe(true)
    expect(isTrustedRendererFileUrl('file:///app/dist/renderer/index.html/extra')).toBe(false)
    expect(isTrustedRendererFileUrl('file:///app/dist/renderer/../../tmp/evil.html')).toBe(false)
  })
})
