import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { isPathInside, pathsEqual } from '@main/security/path-utils'

describe('path-utils', () => {
  it('normalizes relative and absolute paths for equality checks', () => {
    const absolute = resolve('/tmp', 'project')
    const relative = resolve('/tmp/project/../project')

    expect(pathsEqual(absolute, relative)).toBe(true)
  })

  it('applies platform case rules when comparing paths', () => {
    const upper = resolve('/tmp/PROJECT')
    const lower = resolve('/tmp/project')
    const equals = pathsEqual(upper, lower)

    if (process.platform === 'win32') {
      expect(equals).toBe(true)
    } else {
      expect(equals).toBe(false)
    }
  })

  it('returns true for exact match and child path', () => {
    expect(isPathInside('/tmp/repo', '/tmp/repo')).toBe(true)
    expect(isPathInside('/tmp/repo', '/tmp/repo/src/index.ts')).toBe(true)
  })

  it('returns false for sibling and traversal paths', () => {
    expect(isPathInside('/tmp/repo', '/tmp/repo-other/file.ts')).toBe(false)
    expect(isPathInside('/tmp/repo', '/tmp/repo/../secret.txt')).toBe(false)
  })
})
