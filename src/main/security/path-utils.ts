import { normalize, resolve, sep } from 'path'

function normalizeForComparison(path: string): string {
  const normalized = normalize(resolve(path))
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export function pathsEqual(a: string, b: string): boolean {
  return normalizeForComparison(a) === normalizeForComparison(b)
}

export function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = normalizeForComparison(parent)
  const normalizedChild = normalizeForComparison(child)

  if (normalizedParent === normalizedChild) return true

  const prefix = normalizedParent.endsWith(sep) ? normalizedParent : `${normalizedParent}${sep}`
  return normalizedChild.startsWith(prefix)
}
