import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsPackaged } = vi.hoisted(() => {
  return { mockIsPackaged: { value: false } }
})

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
  },
}))

import { validateIpcSender } from '@main/security/validate-sender'

function makeFakeEvent(url: string) {
  return { senderFrame: { url } } as any
}

describe('validateIpcSender', () => {
  beforeEach(() => {
    mockIsPackaged.value = false
    delete process.env.VITE_DEV_SERVER_URL
  })

  describe('file:// origins', () => {
    it('allows file:// URLs (production renderer)', () => {
      const event = makeFakeEvent('file:///app/dist/renderer/index.html')
      expect(validateIpcSender(event)).toBe(true)
    })

    it('allows file:// URLs when packaged', () => {
      mockIsPackaged.value = true
      const event = makeFakeEvent('file:///app/dist/renderer/index.html')
      expect(validateIpcSender(event)).toBe(true)
    })

    it('allows bare file:// URL', () => {
      const event = makeFakeEvent('file://')
      expect(validateIpcSender(event)).toBe(true)
    })
  })

  describe('dev server origins', () => {
    it('allows Vite dev server origin in dev mode', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
      const event = makeFakeEvent('http://localhost:5173/')
      expect(validateIpcSender(event)).toBe(true)
    })

    it('allows Vite dev server subpath', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
      const event = makeFakeEvent('http://localhost:5173/src/renderer/index.html')
      expect(validateIpcSender(event)).toBe(true)
    })

    it('allows Vite dev server with trailing slash in env', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173/'
      const event = makeFakeEvent('http://localhost:5173/')
      expect(validateIpcSender(event)).toBe(true)
    })

    it('rejects dev server origin when app is packaged', () => {
      mockIsPackaged.value = true
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
      const event = makeFakeEvent('http://localhost:5173/')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects dev server origin when VITE_DEV_SERVER_URL is not set', () => {
      const event = makeFakeEvent('http://localhost:5173/')
      expect(validateIpcSender(event)).toBe(false)
    })
  })

  describe('rejected origins', () => {
    it('rejects http:// URLs from random hosts', () => {
      const event = makeFakeEvent('http://evil.com/')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects https:// URLs', () => {
      const event = makeFakeEvent('https://attacker.com/')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects data: URLs', () => {
      const event = makeFakeEvent('data:text/html,<script>alert(1)</script>')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects javascript: URLs', () => {
      const event = makeFakeEvent('javascript:void(0)')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects about:blank', () => {
      const event = makeFakeEvent('about:blank')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects wrong localhost port', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
      const event = makeFakeEvent('http://localhost:9999/')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects different host with same port', () => {
      process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
      const event = makeFakeEvent('http://attacker.com:5173/')
      expect(validateIpcSender(event)).toBe(false)
    })

    it('rejects empty string', () => {
      const event = makeFakeEvent('')
      expect(validateIpcSender(event)).toBe(false)
    })
  })

  describe('error handling', () => {
    it('returns false when senderFrame is null', () => {
      const event = { senderFrame: null } as any
      expect(validateIpcSender(event)).toBe(false)
    })

    it('returns false when senderFrame is undefined', () => {
      const event = {} as any
      expect(validateIpcSender(event)).toBe(false)
    })

    it('returns false when event is null', () => {
      expect(validateIpcSender(null as any)).toBe(false)
    })
  })
})
