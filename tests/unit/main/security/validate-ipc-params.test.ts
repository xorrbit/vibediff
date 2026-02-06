import { describe, it, expect } from 'vitest'
import {
  assertString,
  assertNonEmptyString,
  assertOptionalString,
  assertFiniteNumber,
  assertBoolean,
  assertPositiveInt,
  assertPtySpawnOptions,
  assertPtyResizeOptions,
  MAX_PATH_LENGTH,
  MAX_SESSION_ID_LENGTH,
  MAX_PTY_DATA_LENGTH,
  MIN_TERMINAL_DIMENSION,
  MAX_TERMINAL_DIMENSION,
} from '@main/security/validate-ipc-params'

describe('validate-ipc-params', () => {
  describe('assertString', () => {
    it('accepts a string', () => {
      expect(() => assertString('hello', 'param')).not.toThrow()
    })

    it('accepts an empty string', () => {
      expect(() => assertString('', 'param')).not.toThrow()
    })

    it('rejects non-string types', () => {
      for (const value of [123, true, null, undefined, {}, []]) {
        expect(() => assertString(value, 'param')).toThrow(TypeError)
      }
    })

    it('includes parameter name in error', () => {
      expect(() => assertString(42, 'myParam')).toThrow(/myParam/)
    })

    it('rejects strings exceeding maxLength', () => {
      expect(() => assertString('a'.repeat(101), 'param', 100)).toThrow(/maximum length/)
    })

    it('accepts strings at exactly maxLength', () => {
      expect(() => assertString('a'.repeat(100), 'param', 100)).not.toThrow()
    })

    it('uses MAX_PATH_LENGTH as default maxLength', () => {
      expect(() => assertString('a'.repeat(MAX_PATH_LENGTH), 'param')).not.toThrow()
      expect(() => assertString('a'.repeat(MAX_PATH_LENGTH + 1), 'param')).toThrow(/maximum length/)
    })
  })

  describe('assertNonEmptyString', () => {
    it('accepts a non-empty string', () => {
      expect(() => assertNonEmptyString('hello', 'param')).not.toThrow()
    })

    it('rejects an empty string', () => {
      expect(() => assertNonEmptyString('', 'param')).toThrow(/must not be empty/)
    })

    it('rejects non-string types', () => {
      for (const value of [123, true, null, undefined, {}, []]) {
        expect(() => assertNonEmptyString(value, 'param')).toThrow(TypeError)
      }
    })

    it('includes parameter name in error', () => {
      expect(() => assertNonEmptyString('', 'dir')).toThrow(/dir/)
    })

    it('rejects strings exceeding maxLength', () => {
      expect(() => assertNonEmptyString('a'.repeat(101), 'param', 100)).toThrow(/maximum length/)
    })
  })

  describe('assertOptionalString', () => {
    it('accepts undefined', () => {
      expect(() => assertOptionalString(undefined, 'param')).not.toThrow()
    })

    it('accepts a non-empty string', () => {
      expect(() => assertOptionalString('hello', 'param')).not.toThrow()
    })

    it('rejects an empty string', () => {
      expect(() => assertOptionalString('', 'param')).toThrow(/must not be empty/)
    })

    it('rejects null', () => {
      expect(() => assertOptionalString(null, 'param')).toThrow(TypeError)
    })

    it('rejects non-string types', () => {
      for (const value of [123, true, {}, []]) {
        expect(() => assertOptionalString(value, 'param')).toThrow(TypeError)
      }
    })

    it('rejects strings exceeding maxLength', () => {
      expect(() => assertOptionalString('a'.repeat(101), 'param', 100)).toThrow(/maximum length/)
    })
  })

  describe('assertFiniteNumber', () => {
    it('accepts finite numbers', () => {
      for (const value of [0, 1, -1, 3.14, Number.MAX_SAFE_INTEGER]) {
        expect(() => assertFiniteNumber(value, 'param')).not.toThrow()
      }
    })

    it('rejects NaN', () => {
      expect(() => assertFiniteNumber(NaN, 'param')).toThrow(TypeError)
    })

    it('rejects Infinity', () => {
      expect(() => assertFiniteNumber(Infinity, 'param')).toThrow(TypeError)
      expect(() => assertFiniteNumber(-Infinity, 'param')).toThrow(TypeError)
    })

    it('rejects non-number types', () => {
      for (const value of ['42', true, null, undefined, {}, []]) {
        expect(() => assertFiniteNumber(value, 'param')).toThrow(TypeError)
      }
    })

    it('includes parameter name in error', () => {
      expect(() => assertFiniteNumber('x', 'xPos')).toThrow(/xPos/)
    })

    it('includes NaN/Infinity in error message', () => {
      expect(() => assertFiniteNumber(NaN, 'param')).toThrow(/NaN/)
      expect(() => assertFiniteNumber(Infinity, 'param')).toThrow(/Infinity/)
    })
  })

  describe('assertBoolean', () => {
    it('accepts true and false', () => {
      expect(() => assertBoolean(true, 'param')).not.toThrow()
      expect(() => assertBoolean(false, 'param')).not.toThrow()
    })

    it('rejects truthy/falsy non-booleans', () => {
      for (const value of [0, 1, '', 'true', null, undefined, {}, []]) {
        expect(() => assertBoolean(value, 'param')).toThrow(TypeError)
      }
    })

    it('includes parameter name in error', () => {
      expect(() => assertBoolean(1, 'hasSelection')).toThrow(/hasSelection/)
    })
  })

  describe('assertPositiveInt', () => {
    it('accepts integers within bounds', () => {
      expect(() => assertPositiveInt(1, 'cols', 1, 500)).not.toThrow()
      expect(() => assertPositiveInt(500, 'cols', 1, 500)).not.toThrow()
      expect(() => assertPositiveInt(80, 'cols', 1, 500)).not.toThrow()
    })

    it('rejects values below min', () => {
      expect(() => assertPositiveInt(0, 'cols', 1, 500)).toThrow(/between 1 and 500/)
    })

    it('rejects values above max', () => {
      expect(() => assertPositiveInt(501, 'cols', 1, 500)).toThrow(/between 1 and 500/)
    })

    it('rejects non-integers', () => {
      expect(() => assertPositiveInt(1.5, 'cols', 1, 500)).toThrow(TypeError)
    })

    it('rejects non-number types', () => {
      for (const value of ['80', true, null, undefined, {}, []]) {
        expect(() => assertPositiveInt(value, 'cols', 1, 500)).toThrow(TypeError)
      }
    })

    it('rejects NaN and Infinity', () => {
      expect(() => assertPositiveInt(NaN, 'cols', 1, 500)).toThrow(TypeError)
      expect(() => assertPositiveInt(Infinity, 'cols', 1, 500)).toThrow(TypeError)
    })

    it('includes parameter name in error', () => {
      expect(() => assertPositiveInt(0, 'rows', 1, 500)).toThrow(/rows/)
    })
  })

  describe('assertPtySpawnOptions', () => {
    it('accepts valid options', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc', cwd: '/home' })).not.toThrow()
    })

    it('accepts valid options with shell', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc', cwd: '/home', shell: '/bin/bash' })).not.toThrow()
    })

    it('accepts options with shell undefined', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc', cwd: '/home', shell: undefined })).not.toThrow()
    })

    it('rejects non-object values', () => {
      for (const value of [null, undefined, 'string', 123, true]) {
        expect(() => assertPtySpawnOptions(value)).toThrow(TypeError)
      }
    })

    it('rejects missing sessionId', () => {
      expect(() => assertPtySpawnOptions({ cwd: '/home' })).toThrow(/sessionId/)
    })

    it('rejects missing cwd', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc' })).toThrow(/cwd/)
    })

    it('rejects empty sessionId', () => {
      expect(() => assertPtySpawnOptions({ sessionId: '', cwd: '/home' })).toThrow(/sessionId/)
    })

    it('rejects empty cwd', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc', cwd: '' })).toThrow(/cwd/)
    })

    it('rejects non-string sessionId', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 123, cwd: '/home' })).toThrow(/sessionId/)
    })

    it('rejects sessionId exceeding MAX_SESSION_ID_LENGTH', () => {
      expect(() => assertPtySpawnOptions({
        sessionId: 'a'.repeat(MAX_SESSION_ID_LENGTH + 1),
        cwd: '/home',
      })).toThrow(/maximum length/)
    })

    it('rejects empty shell string', () => {
      expect(() => assertPtySpawnOptions({ sessionId: 'abc', cwd: '/home', shell: '' })).toThrow(/shell/)
    })
  })

  describe('assertPtyResizeOptions', () => {
    it('accepts valid options', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: 80, rows: 24 })).not.toThrow()
    })

    it('accepts boundary values', () => {
      expect(() => assertPtyResizeOptions({
        sessionId: 'abc',
        cols: MIN_TERMINAL_DIMENSION,
        rows: MIN_TERMINAL_DIMENSION,
      })).not.toThrow()
      expect(() => assertPtyResizeOptions({
        sessionId: 'abc',
        cols: MAX_TERMINAL_DIMENSION,
        rows: MAX_TERMINAL_DIMENSION,
      })).not.toThrow()
    })

    it('rejects non-object values', () => {
      for (const value of [null, undefined, 'string', 123, true]) {
        expect(() => assertPtyResizeOptions(value)).toThrow(TypeError)
      }
    })

    it('rejects missing sessionId', () => {
      expect(() => assertPtyResizeOptions({ cols: 80, rows: 24 })).toThrow(/sessionId/)
    })

    it('rejects missing cols', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', rows: 24 })).toThrow(/cols/)
    })

    it('rejects missing rows', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: 80 })).toThrow(/rows/)
    })

    it('rejects cols below minimum', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: 0, rows: 24 })).toThrow(/cols/)
    })

    it('rejects cols above maximum', () => {
      expect(() => assertPtyResizeOptions({
        sessionId: 'abc',
        cols: MAX_TERMINAL_DIMENSION + 1,
        rows: 24,
      })).toThrow(/cols/)
    })

    it('rejects rows below minimum', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: 80, rows: 0 })).toThrow(/rows/)
    })

    it('rejects rows above maximum', () => {
      expect(() => assertPtyResizeOptions({
        sessionId: 'abc',
        cols: 80,
        rows: MAX_TERMINAL_DIMENSION + 1,
      })).toThrow(/rows/)
    })

    it('rejects non-integer cols', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: 80.5, rows: 24 })).toThrow(/cols/)
    })

    it('rejects non-number cols', () => {
      expect(() => assertPtyResizeOptions({ sessionId: 'abc', cols: '80', rows: 24 })).toThrow(/cols/)
    })
  })

  describe('constants', () => {
    it('has expected constant values', () => {
      expect(MAX_PATH_LENGTH).toBe(32_768)
      expect(MAX_SESSION_ID_LENGTH).toBe(256)
      expect(MAX_PTY_DATA_LENGTH).toBe(1_048_576)
      expect(MIN_TERMINAL_DIMENSION).toBe(1)
      expect(MAX_TERMINAL_DIMENSION).toBe(500)
    })
  })
})
