import simpleGit, { SimpleGit, StatusResult } from 'simple-git'
import { ChangedFile, DiffContent, FileStatus } from '@shared/types'
import { existsSync } from 'fs'
import { join } from 'path'

export class GitService {
  // Cache main branch per directory (rarely changes during session)
  private mainBranchCache = new Map<string, { branch: string; timestamp: number }>()
  private static MAIN_BRANCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  // Cache SimpleGit instances per directory
  private gitInstances = new Map<string, SimpleGit>()

  // Cache git repo check (directories rarely become/stop being git repos)
  private gitRepoCache = new Map<string, { isRepo: boolean; timestamp: number }>()
  private static GIT_REPO_CACHE_TTL = 30 * 1000 // 30 seconds

  /**
   * Check if a directory is a git repository (cached).
   */
  private isGitRepo(dir: string): boolean {
    const cached = this.gitRepoCache.get(dir)
    if (cached && Date.now() - cached.timestamp < GitService.GIT_REPO_CACHE_TTL) {
      return cached.isRepo
    }
    const isRepo = existsSync(join(dir, '.git'))
    this.gitRepoCache.set(dir, { isRepo, timestamp: Date.now() })
    return isRepo
  }

  /**
   * Get a cached SimpleGit instance for a directory.
   */
  private getGit(dir: string): SimpleGit | null {
    if (!this.isGitRepo(dir)) {
      // Clean up cached instance if directory is no longer a repo
      this.gitInstances.delete(dir)
      return null
    }

    let git = this.gitInstances.get(dir)
    if (!git) {
      git = simpleGit(dir)
      this.gitInstances.set(dir, git)
    }
    return git
  }

  /**
   * Get the current branch name.
   */
  async getCurrentBranch(dir: string): Promise<string | null> {
    const git = this.getGit(dir)
    if (!git) return null

    try {
      const branches = await git.branchLocal()
      return branches.current || null
    } catch (error) {
      console.error('Error getting current branch:', error)
      return null
    }
  }

  /**
   * Detect the main branch (main, master, or default).
   * Results are cached for 5 minutes to avoid repeated git operations.
   */
  async getMainBranch(dir: string): Promise<string | null> {
    // Check cache first
    const cached = this.mainBranchCache.get(dir)
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
            this.mainBranchCache.set(dir, { branch, timestamp: Date.now() })
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
          this.mainBranchCache.set(dir, { branch: name, timestamp: Date.now() })
          return name
        }
      }

      // Return the current branch as fallback
      const branch = branches.current || null
      if (branch) {
        this.mainBranchCache.set(dir, { branch, timestamp: Date.now() })
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
    const git = this.getGit(dir)
    if (!git) return []

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
          const diffSummary = await git.diffSummary([`${base}...HEAD`])
          for (const file of diffSummary.files) {
            if (!addedPaths.has(file.file)) {
              let status: FileStatus = 'M'
              // Check if file has insertions/deletions (text file)
              if ('insertions' in file && 'deletions' in file) {
                if (file.insertions > 0 && file.deletions === 0) {
                  status = 'A'
                } else if (file.deletions > 0 && file.insertions === 0) {
                  status = 'D'
                }
              }
              files.push({ path: file.file, status })
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

  /**
   * Get diff content for a specific file.
   */
  async getFileDiff(
    dir: string,
    filePath: string,
    baseBranch?: string
  ): Promise<DiffContent | null> {
    const git = this.getGit(dir)
    if (!git) return null

    try {
      const base = baseBranch || (await this.getMainBranch(dir)) || 'HEAD'

      // Get original content from base
      let original = ''
      try {
        original = await git.show([`${base}:${filePath}`])
      } catch {
        // File might be new, no original content
      }

      // Get modified content from working directory
      let modified = ''
      try {
        const { readFile } = await import('fs/promises')
        modified = await readFile(join(dir, filePath), 'utf-8')
      } catch {
        // File might be deleted
      }

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
    const git = this.getGit(dir)
    if (!git) return null

    try {
      if (ref) {
        return await git.show([`${ref}:${filePath}`])
      } else {
        const { readFile } = await import('fs/promises')
        return await readFile(join(dir, filePath), 'utf-8')
      }
    } catch (error) {
      console.error('Error getting file content:', error)
      return null
    }
  }
}
