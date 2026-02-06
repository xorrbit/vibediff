import simpleGit, { SimpleGit, StatusResult } from 'simple-git'
import { ChangedFile, DiffContent, FileStatus } from '@shared/types'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import { debugLog } from '../logger'

/**
 * Validate a git ref (branch name, tag, commit) against argument injection.
 * simple-git uses execFile so shell injection isn't possible, but a ref
 * starting with "--" could be interpreted as a git flag by some subcommands.
 */
function isValidRef(ref: string): boolean {
  return /^[\w\-./]+$/.test(ref)
}

/**
 * Resolve a repo-relative file path and verify it stays within the repo root.
 * Returns the resolved absolute path, or null if the path escapes the repo.
 */
function resolveRepoPath(gitRoot: string, filePath: string): string | null {
  const resolved = resolve(gitRoot, filePath)
  if (!resolved.startsWith(gitRoot + '/') && resolved !== gitRoot) {
    return null
  }
  return resolved
}

export class GitService {
  // Cache current branch per git root (short TTL — changes on checkout)
  private currentBranchCache = new Map<string, { branch: string | null; timestamp: number }>()
  private static CURRENT_BRANCH_CACHE_TTL = 2000 // 2 seconds

  // Cache main branch per git root (rarely changes during session)
  private mainBranchCache = new Map<string, { branch: string; timestamp: number }>()
  private static MAIN_BRANCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  // Cache SimpleGit instances per git root
  private gitInstances = new Map<string, SimpleGit>()

  // Cache git root lookup (maps any directory to its git root, or null)
  private gitRootCache = new Map<string, { gitRoot: string | null; timestamp: number }>()
  private static GIT_ROOT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  // Cache branch diff-summary files by commit state (base tip + HEAD).
  // This avoids re-running expensive `git diffSummary(base...HEAD)` on every poll.
  private branchDiffCache = new Map<string, ChangedFile[]>()
  private static BRANCH_DIFF_CACHE_MAX = 100

  /**
   * Find the git root for a directory by walking up parent dirs.
   * Caches every visited directory along the way (hierarchical backfill).
   * Negative results (non-git dirs) are cached too.
   */
  findGitRoot(dir: string): string | null {
    const normalizedDir = resolve(dir)

    // Check cache first
    const cached = this.gitRootCache.get(normalizedDir)
    if (cached && Date.now() - cached.timestamp < GitService.GIT_ROOT_CACHE_TTL) {
      return cached.gitRoot
    }

    debugLog('findGitRoot:', normalizedDir)

    // Walk up the directory tree
    const visited: string[] = []
    let current = normalizedDir

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check if this intermediate dir is already cached
      const cachedIntermediate = this.gitRootCache.get(current)
      if (cachedIntermediate && Date.now() - cachedIntermediate.timestamp < GitService.GIT_ROOT_CACHE_TTL) {
        // Backfill all visited dirs with the same result
        const now = Date.now()
        for (const dir of visited) {
          this.gitRootCache.set(dir, { gitRoot: cachedIntermediate.gitRoot, timestamp: now })
        }
        return cachedIntermediate.gitRoot
      }

      visited.push(current)

      if (existsSync(join(current, '.git'))) {
        // Found git root — backfill all visited dirs
        const now = Date.now()
        for (const dir of visited) {
          this.gitRootCache.set(dir, { gitRoot: current, timestamp: now })
        }
        return current
      }

      const parent = dirname(current)
      if (parent === current) {
        // Reached filesystem root without finding .git
        const now = Date.now()
        for (const dir of visited) {
          this.gitRootCache.set(dir, { gitRoot: null, timestamp: now })
        }
        return null
      }
      current = parent
    }
  }

  /**
   * Get a cached SimpleGit instance and its git root for a directory.
   * Resolves to git root first, keys instance by git root.
   */
  private getGitWithRoot(dir: string): { git: SimpleGit; gitRoot: string } | null {
    const gitRoot = this.findGitRoot(dir)
    if (!gitRoot) return null

    let git = this.gitInstances.get(gitRoot)
    if (!git) {
      git = simpleGit(gitRoot)
      this.gitInstances.set(gitRoot, git)
    }
    return { git, gitRoot }
  }

  private getGit(dir: string): SimpleGit | null {
    return this.getGitWithRoot(dir)?.git ?? null
  }

  /**
   * Get the current branch name.
   * Cached briefly (2s) to avoid redundant git calls from parallel polling.
   */
  async getCurrentBranch(dir: string): Promise<string | null> {
    const result = this.getGitWithRoot(dir)
    if (!result) return null

    // Check cache (keyed by git root so multiple cwds in the same repo share one entry)
    const cached = this.currentBranchCache.get(result.gitRoot)
    if (cached && Date.now() - cached.timestamp < GitService.CURRENT_BRANCH_CACHE_TTL) {
      return cached.branch
    }

    try {
      const branches = await result.git.branchLocal()
      const branch = branches.current || null
      this.currentBranchCache.set(result.gitRoot, { branch, timestamp: Date.now() })
      return branch
    } catch (error) {
      console.error('Error getting current branch:', error)
      return null
    }
  }

  /**
   * Detect the main branch (main, master, or default).
   * Results are cached by git root for 5 minutes to avoid repeated git operations.
   */
  async getMainBranch(dir: string): Promise<string | null> {
    const gitRoot = this.findGitRoot(dir)
    if (!gitRoot) return null

    // Check cache first (keyed by git root)
    const cached = this.mainBranchCache.get(gitRoot)
    if (cached && Date.now() - cached.timestamp < GitService.MAIN_BRANCH_CACHE_TTL) {
      return cached.branch
    }

    const git = this.getGit(dir)
    if (!git) return null

    try {
      // Try to get the default branch from remote
      const remotes = await git.getRemotes(true)
      if (remotes.length > 0) {
        try {
          const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD'])
          const match = result.match(/refs\/remotes\/origin\/(.+)/)
          if (match) {
            const branch = match[1].trim()
            this.mainBranchCache.set(gitRoot, { branch, timestamp: Date.now() })
            return branch
          }
        } catch {
          // symbolic-ref might fail if HEAD not set
        }
      }

      // Try common branch names
      const branches = await git.branchLocal()
      const commonNames = ['main', 'master', 'develop', 'dev']

      for (const name of commonNames) {
        if (branches.all.includes(name)) {
          this.mainBranchCache.set(gitRoot, { branch: name, timestamp: Date.now() })
          return name
        }
      }

      // Return the current branch as fallback
      const branch = branches.current || null
      if (branch) {
        this.mainBranchCache.set(gitRoot, { branch, timestamp: Date.now() })
      }
      return branch
    } catch (error) {
      console.error('Error getting main branch:', error)
      return null
    }
  }

  /**
   * Get list of changed files compared to base branch.
   */
  async getChangedFiles(dir: string, baseBranch?: string): Promise<ChangedFile[]> {
    if (baseBranch && !isValidRef(baseBranch)) return []
    const result = this.getGitWithRoot(dir)
    if (!result) return []
    const { git, gitRoot } = result

    try {
      // Run status and main branch detection in parallel
      const [status, base] = await Promise.all([
        git.status(),
        baseBranch ? Promise.resolve(baseBranch) : this.getMainBranch(dir),
      ])
      const files: ChangedFile[] = []

      // Track files we've already added
      const addedPaths = new Set<string>()

      // Add staged files
      for (const file of status.staged) {
        files.push({ path: file, status: this.getStatusFromGit(status, file) })
        addedPaths.add(file)
      }

      // Add modified files (not staged)
      for (const file of status.modified) {
        if (!addedPaths.has(file)) {
          files.push({ path: file, status: 'M' })
          addedPaths.add(file)
        }
      }

      // Add new files
      for (const file of status.not_added) {
        if (!addedPaths.has(file)) {
          files.push({ path: file, status: '?' })
          addedPaths.add(file)
        }
      }

      // Add deleted files
      for (const file of status.deleted) {
        if (!addedPaths.has(file)) {
          files.push({ path: file, status: 'D' })
          addedPaths.add(file)
        }
      }

      // Add created files (staged new files)
      for (const file of status.created) {
        if (!addedPaths.has(file)) {
          files.push({ path: file, status: 'A' })
          addedPaths.add(file)
        }
      }

      // If we have a base branch, also get diff against it
      // Use three-dot syntax to show only changes introduced by current branch
      // (not changes made to base after branch was created)
      if (base) {
        try {
          const branchDiffFiles = await this.getBranchDiffFiles(git, gitRoot, base)
          for (const file of branchDiffFiles) {
            if (!addedPaths.has(file.path)) {
              files.push(file)
            }
          }
        } catch {
          // Ignore errors getting diff against base
        }
      }

      return files
    } catch (error) {
      console.error('Error getting changed files:', error)
      return []
    }
  }

  private getStatusFromGit(status: StatusResult, file: string): FileStatus {
    if (status.created.includes(file)) return 'A'
    if (status.deleted.includes(file)) return 'D'
    if (status.renamed.some((r) => r.to === file)) return 'R'
    return 'M'
  }

  private getStatusFromDiffSummary(file: unknown): FileStatus {
    const insertions = (
      typeof file === 'object' &&
      file !== null &&
      'insertions' in file &&
      typeof (file as { insertions?: unknown }).insertions === 'number'
    ) ? (file as { insertions: number }).insertions : 0

    const deletions = (
      typeof file === 'object' &&
      file !== null &&
      'deletions' in file &&
      typeof (file as { deletions?: unknown }).deletions === 'number'
    ) ? (file as { deletions: number }).deletions : 0

    if (insertions > 0 && deletions === 0) return 'A'
    if (deletions > 0 && insertions === 0) return 'D'
    return 'M'
  }

  private setBranchDiffCacheEntry(key: string, files: ChangedFile[]): void {
    // Move key to the end for basic LRU behavior
    this.branchDiffCache.delete(key)
    this.branchDiffCache.set(key, files)

    while (this.branchDiffCache.size > GitService.BRANCH_DIFF_CACHE_MAX) {
      const oldest = this.branchDiffCache.keys().next().value
      if (oldest !== undefined) {
        this.branchDiffCache.delete(oldest)
      }
    }
  }

  private async getBranchDiffCacheKey(
    git: SimpleGit,
    gitRoot: string,
    base: string
  ): Promise<string | null> {
    try {
      // Key cache by resolved commit refs, not branch names, so cache invalidates
      // automatically when base or HEAD changes.
      const [headRefRaw, baseRefRaw] = await Promise.all([
        git.raw(['rev-parse', 'HEAD']),
        git.raw(['rev-parse', base]),
      ])

      if (typeof headRefRaw !== 'string' || typeof baseRefRaw !== 'string') return null
      const headRef = headRefRaw.trim()
      const baseRef = baseRefRaw.trim()
      if (!headRef || !baseRef) return null

      return `${gitRoot}|${base}|${baseRef}|${headRef}`
    } catch {
      return null
    }
  }

  private async getBranchDiffFiles(
    git: SimpleGit,
    gitRoot: string,
    base: string
  ): Promise<ChangedFile[]> {
    const cacheKey = await this.getBranchDiffCacheKey(git, gitRoot, base)
    if (cacheKey) {
      const cached = this.branchDiffCache.get(cacheKey)
      if (cached) return cached
    }

    const diffSummary = await git.diffSummary([`${base}...HEAD`])
    const files = diffSummary.files.map((file) => ({
      path: file.file,
      status: this.getStatusFromDiffSummary(file),
    }))

    if (cacheKey) {
      this.setBranchDiffCacheEntry(cacheKey, files)
    }

    return files
  }

  /**
   * Get diff content for a specific file.
   * Reads working file from git root since paths are repo-relative.
   */
  async getFileDiff(
    dir: string,
    filePath: string,
    baseBranch?: string
  ): Promise<DiffContent | null> {
    if (baseBranch && !isValidRef(baseBranch)) return null
    const result = this.getGitWithRoot(dir)
    if (!result) return null

    try {
      const base = baseBranch || (await this.getMainBranch(dir)) || 'HEAD'

      // Reject paths that escape the repo root
      const safePath = resolveRepoPath(result.gitRoot, filePath)
      if (!safePath) return null

      // Fetch original (git show) and modified (working file) in parallel
      const [original, modified] = await Promise.all([
        result.git.show([`${base}:${filePath}`]).catch(() => ''),
        readFile(safePath, 'utf-8').catch(() => ''),
      ])

      return { original, modified }
    } catch (error) {
      console.error('Error getting file diff:', error)
      return null
    }
  }

  /**
   * Get file content at a specific ref.
   */
  async getFileContent(
    dir: string,
    filePath: string,
    ref?: string
  ): Promise<string | null> {
    if (ref && !isValidRef(ref)) return null
    const result = this.getGitWithRoot(dir)

    try {
      if (ref) {
        if (!result) return null
        return await result.git.show([`${ref}:${filePath}`])
      } else {
        const readDir = result?.gitRoot || dir
        const safePath = resolveRepoPath(readDir, filePath)
        if (!safePath) return null
        return await readFile(safePath, 'utf-8')
      }
    } catch (error) {
      console.error('Error getting file content:', error)
      return null
    }
  }
}
