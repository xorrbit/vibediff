import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExistsSync, mockSimpleGit } = vi.hoisted(() => {
  const mockGitInstance = {
    branchLocal: vi.fn(),
    getRemotes: vi.fn(),
    raw: vi.fn(),
    status: vi.fn(),
    diffSummary: vi.fn(),
    show: vi.fn(),
  }
  return {
    mockExistsSync: vi.fn(),
    mockSimpleGit: vi.fn(() => mockGitInstance),
  }
})

vi.mock('fs', () => {
  const mod = { existsSync: mockExistsSync }
  return { ...mod, default: mod }
})

vi.mock('simple-git', () => {
  const mod = mockSimpleGit
  return { ...mod, default: mod }
})

import { GitService } from '@main/services/git'

function getGitMock() {
  return mockSimpleGit() as ReturnType<typeof mockSimpleGit>
}

describe('GitService', () => {
  let service: GitService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GitService()
    // Default: .git exists in /repo
    mockExistsSync.mockImplementation((path: string) => {
      return path === '/repo/.git'
    })
  })

  describe('findGitRoot', () => {
    it('returns the directory itself when .git exists there', () => {
      mockExistsSync.mockImplementation((path: string) => path === '/repo/.git')

      const result = service.findGitRoot('/repo')

      expect(result).toBe('/repo')
    })

    it('walks up parent directories to find git root', () => {
      mockExistsSync.mockImplementation((path: string) => path === '/repo/.git')

      const result = service.findGitRoot('/repo/src/components')

      expect(result).toBe('/repo')
    })

    it('returns null for non-git directories', () => {
      mockExistsSync.mockReturnValue(false)

      const result = service.findGitRoot('/not-a-repo')

      expect(result).toBeNull()
    })

    it('caches and backfills all visited directories', () => {
      mockExistsSync.mockImplementation((path: string) => path === '/repo/.git')

      // First call walks up from /repo/src/deep
      service.findGitRoot('/repo/src/deep')
      mockExistsSync.mockClear()

      // Second call to a sibling-like dir that was visited should use cache
      const result = service.findGitRoot('/repo/src')

      // Should not have called existsSync again (cached)
      expect(mockExistsSync).not.toHaveBeenCalled()
      expect(result).toBe('/repo')
    })

    it('caches negative results', () => {
      mockExistsSync.mockReturnValue(false)

      service.findGitRoot('/not-a-repo')
      mockExistsSync.mockClear()

      const result = service.findGitRoot('/not-a-repo')

      expect(mockExistsSync).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('uses cached intermediate dir to shortcut walk-up', () => {
      mockExistsSync.mockImplementation((path: string) => path === '/repo/.git')

      // Prime cache for /repo/src
      service.findGitRoot('/repo/src')
      mockExistsSync.mockClear()

      // Now lookup /repo/src/lib — walks to /repo/src/lib (uncached), checks .git there,
      // then walks to /repo/src which IS cached, shortcutting the rest of the walk
      const result = service.findGitRoot('/repo/src/lib')

      expect(result).toBe('/repo')
      // Only checked /repo/src/lib/.git before hitting the cached /repo/src
      expect(mockExistsSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCurrentBranch', () => {
    it('returns current branch name', async () => {
      getGitMock().branchLocal.mockResolvedValue({ current: 'feature/test', all: ['main', 'feature/test'] })

      const result = await service.getCurrentBranch('/repo')

      expect(result).toBe('feature/test')
    })

    it('returns null when not a git repo', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.getCurrentBranch('/not-a-repo')

      expect(result).toBeNull()
    })

    it('returns null on error', async () => {
      getGitMock().branchLocal.mockRejectedValue(new Error('git error'))

      const result = await service.getCurrentBranch('/repo')

      expect(result).toBeNull()
    })

    it('returns null when current branch is empty', async () => {
      getGitMock().branchLocal.mockResolvedValue({ current: '', all: [] })

      const result = await service.getCurrentBranch('/repo')

      expect(result).toBeNull()
    })
  })

  describe('getMainBranch', () => {
    it('detects main branch from remote symbolic ref', async () => {
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')

      const result = await service.getMainBranch('/repo')

      expect(result).toBe('main')
    })

    it('falls back to common branch names when symbolic-ref fails', async () => {
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockRejectedValue(new Error('not set'))
      getGitMock().branchLocal.mockResolvedValue({ current: 'feature', all: ['feature', 'master'] })

      const result = await service.getMainBranch('/repo')

      expect(result).toBe('master')
    })

    it('prefers "main" over "master"', async () => {
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: 'feature', all: ['feature', 'main', 'master'] })

      const result = await service.getMainBranch('/repo')

      expect(result).toBe('main')
    })

    it('falls back to current branch when no common names found', async () => {
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: 'only-branch', all: ['only-branch'] })

      const result = await service.getMainBranch('/repo')

      expect(result).toBe('only-branch')
    })

    it('caches result for 5 minutes', async () => {
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')

      const result1 = await service.getMainBranch('/repo')
      const result2 = await service.getMainBranch('/repo')

      expect(result1).toBe('main')
      expect(result2).toBe('main')
      // Should only call getRemotes once due to caching
      expect(getGitMock().getRemotes).toHaveBeenCalledTimes(1)
    })

    it('returns null when not a git repo', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.getMainBranch('/not-repo')

      expect(result).toBeNull()
    })

    it('returns null on error', async () => {
      getGitMock().getRemotes.mockRejectedValue(new Error('git error'))

      const result = await service.getMainBranch('/repo')

      expect(result).toBeNull()
    })

    it('tries develop and dev as fallback branch names', async () => {
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: 'feature', all: ['feature', 'develop'] })

      const result = await service.getMainBranch('/repo')

      expect(result).toBe('develop')
    })
  })

  describe('getChangedFiles', () => {
    const mockStatus = {
      staged: ['staged.ts'],
      modified: ['modified.ts'],
      not_added: ['new.ts'],
      deleted: ['deleted.ts'],
      created: ['created.ts'],
      renamed: [],
    }

    it('returns all changed files with correct statuses', async () => {
      getGitMock().status.mockResolvedValue(mockStatus)
      // No main branch
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: '', all: [] })

      const files = await service.getChangedFiles('/repo')

      expect(files).toContainEqual({ path: 'staged.ts', status: 'M' })
      expect(files).toContainEqual({ path: 'modified.ts', status: 'M' })
      expect(files).toContainEqual({ path: 'new.ts', status: '?' })
      expect(files).toContainEqual({ path: 'deleted.ts', status: 'D' })
      expect(files).toContainEqual({ path: 'created.ts', status: 'A' })
    })

    it('deduplicates files that appear in multiple categories', async () => {
      getGitMock().status.mockResolvedValue({
        staged: ['file.ts'],
        modified: ['file.ts'], // Same file in both staged and modified
        not_added: [],
        deleted: [],
        created: ['file.ts'], // And created
        renamed: [],
      })
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: '', all: [] })

      const files = await service.getChangedFiles('/repo')
      const filePaths = files.map((f) => f.path)

      // Should only appear once
      expect(filePaths.filter((p) => p === 'file.ts')).toHaveLength(1)
    })

    it('includes diff against base branch with three-dot syntax', async () => {
      getGitMock().status.mockResolvedValue({
        staged: [],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
        renamed: [],
      })
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')
      getGitMock().diffSummary.mockResolvedValue({
        files: [{ file: 'diff-file.ts', insertions: 5, deletions: 3 }],
      })

      const files = await service.getChangedFiles('/repo')

      expect(files).toContainEqual({ path: 'diff-file.ts', status: 'M' })
      expect(getGitMock().diffSummary).toHaveBeenCalledWith(['main...HEAD'])
    })

    it('infers status A from diff with only insertions', async () => {
      getGitMock().status.mockResolvedValue({
        staged: [], modified: [], not_added: [], deleted: [], created: [], renamed: [],
      })
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')
      getGitMock().diffSummary.mockResolvedValue({
        files: [{ file: 'new-file.ts', insertions: 10, deletions: 0 }],
      })

      const files = await service.getChangedFiles('/repo')

      expect(files).toContainEqual({ path: 'new-file.ts', status: 'A' })
    })

    it('infers status D from diff with only deletions', async () => {
      getGitMock().status.mockResolvedValue({
        staged: [], modified: [], not_added: [], deleted: [], created: [], renamed: [],
      })
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')
      getGitMock().diffSummary.mockResolvedValue({
        files: [{ file: 'gone.ts', insertions: 0, deletions: 15 }],
      })

      const files = await service.getChangedFiles('/repo')

      expect(files).toContainEqual({ path: 'gone.ts', status: 'D' })
    })

    it('uses provided baseBranch instead of detecting', async () => {
      getGitMock().status.mockResolvedValue({
        staged: [], modified: [], not_added: [], deleted: [], created: [], renamed: [],
      })
      getGitMock().raw.mockResolvedValue('sha\n')
      getGitMock().diffSummary.mockResolvedValue({ files: [] })

      await service.getChangedFiles('/repo', 'develop')

      expect(getGitMock().diffSummary).toHaveBeenCalledWith(['develop...HEAD'])
    })

    it('returns empty array when not a git repo', async () => {
      mockExistsSync.mockReturnValue(false)

      const files = await service.getChangedFiles('/not-repo')

      expect(files).toEqual([])
    })

    it('returns empty array on error', async () => {
      getGitMock().status.mockRejectedValue(new Error('git error'))

      const files = await service.getChangedFiles('/repo')

      expect(files).toEqual([])
    })

    it('handles diff summary error gracefully', async () => {
      getGitMock().status.mockResolvedValue({
        staged: ['file.ts'], modified: [], not_added: [], deleted: [], created: ['file.ts'], renamed: [],
      })
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')
      getGitMock().diffSummary.mockRejectedValue(new Error('diff error'))

      const files = await service.getChangedFiles('/repo')

      // Should still return status files despite diff error
      expect(files.length).toBeGreaterThan(0)
    })

    it('caches branch diff summary when base and HEAD refs are unchanged', async () => {
      getGitMock().status.mockResolvedValue({
        staged: [], modified: [], not_added: [], deleted: [], created: [], renamed: [],
      })
      getGitMock().raw.mockImplementation((args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Promise.resolve('head-sha\n')
        if (args[0] === 'rev-parse' && args[1] === 'main') return Promise.resolve('base-sha\n')
        return Promise.resolve('')
      })
      getGitMock().diffSummary.mockResolvedValue({
        files: [{ file: 'cached.ts', insertions: 1, deletions: 1 }],
      })

      await service.getChangedFiles('/repo', 'main')
      await service.getChangedFiles('/repo', 'main')

      expect(getGitMock().diffSummary).toHaveBeenCalledTimes(1)
    })

    it('invalidates branch diff cache when HEAD changes', async () => {
      let headSha = 'head-sha-1'
      getGitMock().status.mockResolvedValue({
        staged: [], modified: [], not_added: [], deleted: [], created: [], renamed: [],
      })
      getGitMock().raw.mockImplementation((args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Promise.resolve(`${headSha}\n`)
        if (args[0] === 'rev-parse' && args[1] === 'main') return Promise.resolve('base-sha\n')
        return Promise.resolve('')
      })
      getGitMock().diffSummary.mockResolvedValue({
        files: [{ file: 'cached.ts', insertions: 1, deletions: 1 }],
      })

      await service.getChangedFiles('/repo', 'main')
      headSha = 'head-sha-2'
      await service.getChangedFiles('/repo', 'main')

      expect(getGitMock().diffSummary).toHaveBeenCalledTimes(2)
    })

    it('detects renamed files from status', async () => {
      getGitMock().status.mockResolvedValue({
        staged: ['new-name.ts'],
        modified: [],
        not_added: [],
        deleted: [],
        created: [],
        renamed: [{ from: 'old-name.ts', to: 'new-name.ts' }],
      })
      getGitMock().getRemotes.mockResolvedValue([])
      getGitMock().branchLocal.mockResolvedValue({ current: '', all: [] })

      const files = await service.getChangedFiles('/repo')

      expect(files).toContainEqual({ path: 'new-name.ts', status: 'R' })
    })
  })

  describe('getFileDiff', () => {
    it('returns original and modified content', async () => {
      getGitMock().show.mockResolvedValue('original content')
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')

      // Mock fs/promises readFile via dynamic import
      vi.doMock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue('modified content'),
      }))

      const result = await service.getFileDiff('/repo', 'file.ts')

      expect(result).toEqual({ original: 'original content', modified: expect.any(String) })
    })

    it('returns null when not a git repo', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.getFileDiff('/not-repo', 'file.ts')

      expect(result).toBeNull()
    })

    it('handles new file (no original content)', async () => {
      getGitMock().show.mockRejectedValue(new Error('not found'))
      getGitMock().getRemotes.mockResolvedValue([{ name: 'origin' }])
      getGitMock().raw.mockResolvedValue('refs/remotes/origin/main\n')

      const result = await service.getFileDiff('/repo', 'new-file.ts')

      expect(result).not.toBeNull()
      expect(result!.original).toBe('')
    })

    it('returns null on error', async () => {
      // Make getGit fail by returning null
      mockExistsSync.mockReturnValue(false)

      const result = await service.getFileDiff('/repo', 'file.ts')

      expect(result).toBeNull()
    })
  })

  describe('getFileContent', () => {
    it('returns content from git ref', async () => {
      getGitMock().show.mockResolvedValue('content at ref')

      const result = await service.getFileContent('/repo', 'file.ts', 'HEAD')

      expect(result).toBe('content at ref')
      expect(getGitMock().show).toHaveBeenCalledWith(['HEAD:file.ts'])
    })

    it('returns null when not a git repo', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.getFileContent('/not-repo', 'file.ts')

      expect(result).toBeNull()
    })

    it('returns null on error', async () => {
      getGitMock().show.mockRejectedValue(new Error('not found'))

      const result = await service.getFileContent('/repo', 'file.ts', 'HEAD')

      expect(result).toBeNull()
    })
  })

  describe('caching', () => {
    it('caches git root lookup', () => {
      mockExistsSync.mockImplementation((path: string) => path === '/repo/.git')

      // Access twice rapidly
      service.findGitRoot('/repo')
      service.findGitRoot('/repo')

      // existsSync should only be called once (cached on second call)
      expect(mockExistsSync).toHaveBeenCalledTimes(1)
    })

    it('caches SimpleGit instance per git root', () => {
      // /repo1 and /repo1/src share same git root
      mockExistsSync.mockImplementation((path: string) => path === '/repo1/.git')

      service.getCurrentBranch('/repo1')
      service.getCurrentBranch('/repo1/src')

      // simpleGit should be called once (both resolve to same git root /repo1)
      expect(mockSimpleGit).toHaveBeenCalledTimes(1)
      expect(mockSimpleGit).toHaveBeenCalledWith('/repo1')
    })

    it('creates separate SimpleGit instances for different repos', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/repo1/.git' || path === '/repo2/.git'
      )

      service.getCurrentBranch('/repo1')
      service.getCurrentBranch('/repo2')

      expect(mockSimpleGit).toHaveBeenCalledTimes(2)
      expect(mockSimpleGit).toHaveBeenCalledWith('/repo1')
      expect(mockSimpleGit).toHaveBeenCalledWith('/repo2')
    })
  })
})
