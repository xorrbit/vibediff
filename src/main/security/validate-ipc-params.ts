// Runtime validation for IPC handler parameters.
// TypeScript types are erased at runtime — these assertions provide defense-in-depth
// against malformed input if a renderer exploit bypasses contextBridge.

export const MAX_PATH_LENGTH = 32_768
export const MAX_SESSION_ID_LENGTH = 256
export const MAX_PTY_DATA_LENGTH = 1_048_576 // 1 MB — handles large pastes
export const MIN_TERMINAL_DIMENSION = 1
export const MAX_TERMINAL_DIMENSION = 500

export function assertString(value: unknown, name: string, maxLength = MAX_PATH_LENGTH): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string, got ${typeof value}`)
  }
  if (value.length > maxLength) {
    throw new TypeError(`${name} exceeds maximum length of ${maxLength}`)
  }
}

export function assertNonEmptyString(value: unknown, name: string, maxLength = MAX_PATH_LENGTH): asserts value is string {
  assertString(value, name, maxLength)
  if (value.length === 0) {
    throw new TypeError(`${name} must not be empty`)
  }
}

export function assertOptionalString(value: unknown, name: string, maxLength = MAX_PATH_LENGTH): asserts value is string | undefined {
  if (value === undefined) return
  assertNonEmptyString(value, name, maxLength)
}

export function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, got ${typeof value === 'number' ? value : typeof value}`)
  }
}

export function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${name} must be a boolean, got ${typeof value}`)
  }
}

export function assertPositiveInt(value: unknown, name: string, min: number, max: number): asserts value is number {
  assertFiniteNumber(value, name)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}, got ${value}`)
  }
}

export function assertPtySpawnOptions(value: unknown): asserts value is { sessionId: string; cwd: string; shell?: string } {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('PtySpawnOptions must be an object')
  }
  const obj = value as Record<string, unknown>
  assertNonEmptyString(obj.sessionId, 'sessionId', MAX_SESSION_ID_LENGTH)
  assertNonEmptyString(obj.cwd, 'cwd')
  assertOptionalString(obj.shell, 'shell')
}

export function assertPtyResizeOptions(value: unknown): asserts value is { sessionId: string; cols: number; rows: number } {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('PtyResizeOptions must be an object')
  }
  const obj = value as Record<string, unknown>
  assertNonEmptyString(obj.sessionId, 'sessionId', MAX_SESSION_ID_LENGTH)
  assertPositiveInt(obj.cols, 'cols', MIN_TERMINAL_DIMENSION, MAX_TERMINAL_DIMENSION)
  assertPositiveInt(obj.rows, 'rows', MIN_TERMINAL_DIMENSION, MAX_TERMINAL_DIMENSION)
}
