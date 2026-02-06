import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPtySpawn, mockPlatform, mockTmpdir, mockExistsSync, mockReadlinkSync, mockExecAsync, mockMkdirSync, mockWriteFileSync } = vi.hoisted(() => {
  const mockPtyProcess = {
    pid: 12345,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  }
  return {
    mockPtySpawn: vi.fn(() => mockPtyProcess),
    mockPlatform: vi.fn(),
    mockTmpdir: vi.fn(() => '/tmp'),
    mockExistsSync: vi.fn(),
    mockReadlinkSync: vi.fn(),
    mockExecAsync: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
  }
})

vi.mock('node-pty', () => {
  const mod = { spawn: mockPtySpawn }
  return { ...mod, default: mod }
})

vi.mock('os', () => {
  const mod = { platform: mockPlatform, tmpdir: mockTmpdir }
  return { ...mod, default: mod }
})

vi.mock('fs', () => {
  const mod = { existsSync: mockExistsSync, readlinkSync: mockReadlinkSync, mkdirSync: mockMkdirSync, writeFileSync: mockWriteFileSync }
  return { ...mod, default: mod }
})

vi.mock('child_process', () => {
  const mod = { execFile: vi.fn() }
  return { ...mod, default: mod }
})

vi.mock('util', () => {
  const mod = { promisify: () => mockExecAsync }
  return { ...mod, default: mod }
})

vi.mock('./shell', () => ({
  detectShell: () => ({ path: '/bin/bash', name: 'Bash' }),
  getShellName: (path: string) => path.split('/').pop() || path,
}))

import { PtyManager } from '@main/services/pty-manager'

function getPtyMock() {
  return mockPtySpawn() as ReturnType<typeof mockPtySpawn>
}

describe('PtyManager', () => {
  let manager: PtyManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new PtyManager()
    mockPlatform.mockReturnValue('linux')
    mockExistsSync.mockReturnValue(true)
  })

  describe('spawn', () => {
    it('spawns a pty process with correct options', () => {
      manager.spawn('session-1', '/home/user')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        '/bin/bash',
        expect.any(Array),
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: '/home/user',
        })
      )
    })

    it('uses provided shell instead of detecting', () => {
      manager.spawn('session-1', '/home/user', '/bin/zsh')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        '/bin/zsh',
        expect.any(Array),
        expect.anything()
      )
    })

    it('passes bash integration args for bash shell', () => {
      manager.spawn('session-1', '/home/user')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        '/bin/bash',
        ['--rcfile', expect.stringContaining('bash-integration.bash')],
        expect.anything()
      )
    })

    it('kills existing pty before spawning new one for same session', () => {
      manager.spawn('session-1', '/home/user')
      const firstPty = getPtyMock()

      manager.spawn('session-1', '/home/user')

      expect(firstPty.kill).toHaveBeenCalled()
    })

    it('throws when cwd does not exist', () => {
      mockExistsSync.mockReturnValue(false)

      expect(() => manager.spawn('session-1', '/nonexistent')).toThrow('Directory does not exist')
    })

    it('sets env with TERM and COLORTERM', () => {
      manager.spawn('session-1', '/home/user')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          }),
        })
      )
    })

    it('uses conpty on Windows', () => {
      mockPlatform.mockReturnValue('win32')

      manager.spawn('session-1', '/home/user')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Array),
        expect.objectContaining({
          useConpty: true,
        })
      )
    })

    it('does not use conpty on Linux', () => {
      mockPlatform.mockReturnValue('linux')

      manager.spawn('session-1', '/home/user')

      expect(mockPtySpawn).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Array),
        expect.objectContaining({
          useConpty: false,
        })
      )
    })

    it('invokes onData callback when pty emits data', () => {
      const onData = vi.fn()
      const onExit = vi.fn()

      manager.spawn('session-1', '/home/user', undefined, { onData, onExit })

      // Get the onData handler that was registered
      const ptyMock = getPtyMock()
      const dataHandler = ptyMock.onData.mock.calls[0][0]

      dataHandler('hello world')

      expect(onData).toHaveBeenCalledWith('hello world')
    })

    it('invokes onExit callback and cleans up on pty exit', () => {
      const onData = vi.fn()
      const onExit = vi.fn()

      manager.spawn('session-1', '/home/user', undefined, { onData, onExit })

      const ptyMock = getPtyMock()
      const exitHandler = ptyMock.onExit.mock.calls[0][0]

      exitHandler({ exitCode: 0 })

      expect(onExit).toHaveBeenCalledWith(0)
    })

    it('throws wrapped error when pty spawn fails', () => {
      mockPtySpawn.mockImplementationOnce(() => {
        throw new Error('spawn failed')
      })

      expect(() => manager.spawn('session-1', '/home/user')).toThrow('Failed to spawn shell')
    })
  })

  describe('write', () => {
    it('writes data to the pty', () => {
      manager.spawn('session-1', '/home/user')
      const ptyMock = getPtyMock()

      manager.write('session-1', 'ls -la\n')

      expect(ptyMock.write).toHaveBeenCalledWith('ls -la\n')
    })

    it('does nothing for non-existent session', () => {
      // Should not throw
      manager.write('nonexistent', 'data')
    })
  })

  describe('resize', () => {
    it('resizes the pty', () => {
      manager.spawn('session-1', '/home/user')
      const ptyMock = getPtyMock()

      manager.resize('session-1', 120, 40)

      expect(ptyMock.resize).toHaveBeenCalledWith(120, 40)
    })

    it('does nothing for non-existent session', () => {
      manager.resize('nonexistent', 80, 24)
    })
  })

  describe('kill', () => {
    it('kills the pty and removes from instances', () => {
      manager.spawn('session-1', '/home/user')
      const ptyMock = getPtyMock()

      manager.kill('session-1')

      expect(ptyMock.kill).toHaveBeenCalled()
    })

    it('does nothing for non-existent session', () => {
      manager.kill('nonexistent')
    })
  })

  describe('killAll', () => {
    it('kills all pty instances', () => {
      manager.spawn('session-1', '/home/user')
      manager.spawn('session-2', '/home/user')

      manager.killAll()

      // Both should have been killed
      expect(getPtyMock().kill).toHaveBeenCalled()
    })
  })

  describe('getCwd', () => {
    it('returns null for non-existent session', async () => {
      const result = await manager.getCwd('nonexistent')

      expect(result).toBeNull()
    })

    it('reads cwd from /proc on Linux', async () => {
      mockPlatform.mockReturnValue('linux')
      manager.spawn('session-1', '/home/user')
      mockReadlinkSync.mockReturnValue('/home/user/project')

      const result = await manager.getCwd('session-1')

      expect(result).toBe('/home/user/project')
      expect(mockReadlinkSync).toHaveBeenCalledWith('/proc/12345/cwd')
    })

    it('uses lsof on macOS', async () => {
      mockPlatform.mockReturnValue('darwin')
      // Need to re-create manager to pick up platform change
      manager = new PtyManager()
      manager.spawn('session-1', '/home/user')
      mockExecAsync.mockResolvedValue({ stdout: 'p12345\nn/Users/user/project\n' })

      const result = await manager.getCwd('session-1')

      expect(result).toBe('/Users/user/project')
    })

    it('caches CWD for 1 second', async () => {
      mockPlatform.mockReturnValue('linux')
      manager.spawn('session-1', '/home/user')
      mockReadlinkSync.mockReturnValue('/home/user/project')

      const result1 = await manager.getCwd('session-1')
      const result2 = await manager.getCwd('session-1')

      expect(result1).toBe('/home/user/project')
      expect(result2).toBe('/home/user/project')
      // Should only call readlinkSync once due to cache
      expect(mockReadlinkSync).toHaveBeenCalledTimes(1)
    })

    it('returns null when readlinkSync fails on Linux', async () => {
      mockPlatform.mockReturnValue('linux')
      manager.spawn('session-1', '/home/user')
      mockReadlinkSync.mockImplementation(() => {
        throw new Error('ENOENT')
      })

      const result = await manager.getCwd('session-1')

      expect(result).toBeNull()
    })

    it('returns null when lsof fails on macOS', async () => {
      mockPlatform.mockReturnValue('darwin')
      manager = new PtyManager()
      manager.spawn('session-1', '/home/user')
      mockExecAsync.mockRejectedValue(new Error('lsof error'))

      const result = await manager.getCwd('session-1')

      expect(result).toBeNull()
    })

    it('calls execFile with args array instead of shell string on macOS', async () => {
      mockPlatform.mockReturnValue('darwin')
      manager = new PtyManager()
      manager.spawn('session-1', '/home/user')
      mockExecAsync.mockResolvedValue({ stdout: 'p12345\nn/Users/user/project\n' })

      await manager.getCwd('session-1')

      // Verify execFileAsync is called with separate args (not a shell command string)
      expect(mockExecAsync).toHaveBeenCalledWith(
        'lsof',
        ['-a', '-d', 'cwd', '-p', '12345', '-F', 'n'],
        { timeout: 1000 }
      )
    })
  })

  describe('shell integration security', () => {
    it('creates temp directory with mode 0o700', () => {
      manager.spawn('session-1', '/home/user')

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true, mode: 0o700 }
      )
    })

    it('writes integration scripts with mode 0o600', () => {
      manager.spawn('session-1', '/home/user')

      // All three files should be written with restrictive permissions
      for (const call of mockWriteFileSync.mock.calls) {
        expect(call[2]).toEqual({ mode: 0o600 })
      }
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3)
    })
  })
})
