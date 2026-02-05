# Plan: Load VSCode Extension TextMate Grammars into Monaco

## Overview

Scan `~/.vscode/extensions/extensions.json` for installed/enabled extensions, read their TextMate grammar files from `syntaxes/` directories, and wire them into Monaco as token providers. Falls back gracefully to Monaco's built-in Monarch tokenizers when VSCode isn't installed or a grammar isn't available.

## New Dependencies

- `vscode-textmate` ^9.0.0 — TextMate grammar parser
- `vscode-oniguruma` ^2.0.1 — Oniguruma regex engine (ships `onig.wasm`)

## Architecture

```
Main process                          Renderer process
─────────────                         ─────────────────
GrammarScanner service                TextMateService singleton
  1. reads extensions.json              1. receives grammar data via IPC
  2. reads each extension's             2. loads onig.wasm (sent via IPC)
     package.json contributes.grammars  3. creates vscode-textmate Registry
  3. reads raw .tmLanguage.json files   4. calls monaco.languages.setTokensProvider()
  4. returns GrammarScanResult          5. provides ext→language lookup for DiffView
       │                                       │
       └──── IPC (grammar:scan) ───────────────┘
       └──── IPC (grammar:getOnigWasm) ────────┘
```

**Language resolution order in `getLanguage()`:**
1. Check TextMateService for a matching extension → use that language ID
2. Fall back to existing hardcoded `languageMap` → Monaco built-in Monarch tokenizer
3. Fall back to `'plaintext'`

---

## Tasks

### Task 1: Install dependencies ✅

Add `vscode-textmate` and `vscode-oniguruma` to `package.json` dependencies and run `npm install`.

**File:** `package.json`

**Done:** Installed `vscode-textmate@9.3.2` and `vscode-oniguruma@2.0.1`. Confirmed `onig.wasm` present at `node_modules/vscode-oniguruma/release/onig.wasm`.

---

### Task 2: Add shared types and IPC channels ✅

Add new types and channel constants following the existing pattern of `PTY_CHANNELS`, `GIT_CHANNELS`, `FS_CHANNELS`.

**File:** `src/shared/types.ts`

**Done:** Added `GRAMMAR_CHANNELS`, `GrammarContribution`, `GrammarScanResult` types, and `grammar` namespace to `ElectronAPI`. Type-check confirms preload needs updating (Task 6).

Add:
```typescript
export const GRAMMAR_CHANNELS = {
  SCAN: 'grammar:scan',
  GET_ONIG_WASM: 'grammar:getOnigWasm',
} as const

export interface GrammarContribution {
  scopeName: string        // e.g. "source.python"
  languageId: string       // e.g. "python"
  fileExtensions: string[] // e.g. [".py", ".pyw"]
  rawContent: string       // raw grammar file content
  grammarPath: string      // original file path (for format detection)
}

export interface GrammarScanResult {
  grammars: GrammarContribution[]
  errors: string[]         // non-fatal errors encountered during scan
}
```

Add `grammar` namespace to `ElectronAPI` interface:
```typescript
grammar: {
  scan: () => Promise<GrammarScanResult>
  getOnigWasm: () => Promise<Uint8Array | null>
}
```

---

### Task 3: Create GrammarScanner service (main process) ✅

Core filesystem scanning logic. Reads `extensions.json` first to get the list of installed extensions, then reads each one's `package.json` for `contributes.grammars` and `contributes.languages`.

**New file:** `src/main/services/grammar-scanner.ts`

**Done:** Created `GrammarScanner` class with `scan()` and `getOnigWasm()`. Reads `extensions.json` first, resolves extension dirs via `location._fsPath`/`relativeLocation`, loads `contributes.grammars` + `contributes.languages` from each extension's `package.json`. Caches results. All errors non-fatal. Compiles cleanly.

Class: `GrammarScanner`
- `scan(): Promise<GrammarScanResult>` — main entry point, cached after first call
- `getOnigWasm(): Promise<Uint8Array | null>` — reads `onig.wasm` from `node_modules/vscode-oniguruma/release/`
- `private getExtensionsDir(): string` — returns `~/.vscode/extensions/`
- `private async dirExists(path): Promise<boolean>`

**Scanning logic:**
1. Check `~/.vscode/extensions/` exists; if not, return empty result
2. Read `extensions.json` — parse it to get list of installed extensions
   - Each entry has `identifier.id` and either `location._fsPath` (absolute) or `relativeLocation` (folder name relative to extensions dir)
3. For each extension entry, resolve its directory path
4. Read `<extDir>/package.json` → look for `contributes.grammars[]` and `contributes.languages[]`
5. For each grammar in `contributes.grammars`:
   - `language` → the language ID
   - `scopeName` → TextMate scope
   - `path` → relative path to grammar file (resolve against extDir)
6. Collect file extensions from `contributes.languages` entries matching the language ID
7. Read the grammar file content as UTF-8 string
8. Return `GrammarContribution` for each successfully loaded grammar

**Error handling:** All errors are non-fatal — log to `errors[]` array and continue. Cache result since extensions don't change during app lifetime.

---

### Task 4: Create grammar IPC handler ✅

Thin IPC wrapper following the pattern of `src/main/ipc/fs.ts`.

**New file:** `src/main/ipc/grammar.ts`

```typescript
export function registerGrammarHandlers(ipcMain: IpcMain) {
  ipcMain.handle(GRAMMAR_CHANNELS.SCAN, async () => grammarScanner.scan())
  ipcMain.handle(GRAMMAR_CHANNELS.GET_ONIG_WASM, async () => grammarScanner.getOnigWasm())
}
```

**Done:** Created `src/main/ipc/grammar.ts` with `registerGrammarHandlers`. Compiles cleanly.

---

### Task 5: Register grammar IPC handler in main process ✅

**File:** `src/main/index.ts`
- Import `registerGrammarHandlers` and call it in `registerIpcHandlers()`

**File:** `src/main/ipc/index.ts`
- Add `export { registerGrammarHandlers } from './grammar'`

**Done:** Added import and call in `src/main/index.ts`, added re-export in `src/main/ipc/index.ts`.

---

### Task 6: Expose grammar API in preload bridge ✅

**File:** `src/preload/index.ts`

**Done:** Added `GRAMMAR_CHANNELS` to imports. Added `grammar` namespace with `scan` and `getOnigWasm` methods to the `electronAPI` object. Type-checks cleanly.

---

### Task 7: Create TextMateService (renderer process) ✅

Core renderer-side module that initializes vscode-textmate/vscode-oniguruma and wires grammars into Monaco.

**New file:** `src/renderer/lib/textmate.ts`

**Done:** Created `TextMateService` class exported as singleton. Implements `initialize()` (idempotent, handles IPC wasm serialization), `wireGrammarsToMonaco()` (groups by languageId, registers languages, sets token providers), `TokenizerState` (wraps `StateStack` as `monaco.languages.IState`), `getLanguageForFile()` (extension→language lookup), and `hasGrammar()`. All errors caught gracefully — falls back to Monarch tokenizers. Compiles cleanly.

---

### Task 8: Initialize TextMateService at app startup ✅

**File:** `src/renderer/main.tsx`

**Done:** Added fire-and-forget `textMateService.initialize()` call before `ReactDOM.createRoot()`. Non-blocking — app renders immediately while grammars load in the background. Compiles cleanly.

---

### Task 9: Update DiffView language detection ✅

**File:** `src/renderer/components/diff/DiffView.tsx`

**Done:** Added `textMateService` import. Updated `getLanguage()` to check `textMateService.getLanguageForFile()` first, falling back to the existing hardcoded `languageMap`. Compiles cleanly.

---

### Task 10: Update test mocks ✅

**File:** `tests/setup.ts`

**Done:** Added `grammar` mock (returning empty grammars and null wasm) to `mockElectronAPI`. All 126 existing tests pass.

---

### Task 11: Add unit tests for GrammarScanner ✅

**New file:** `tests/unit/main/services/grammar-scanner.test.ts`

**Done:** Added 12 tests covering: empty result when extensions dir missing, missing extensions.json, successful grammar parsing, skipping extensions without grammars, malformed package.json handling, missing grammar files, file extension resolution from contributes.languages, scan caching, location._fsPath resolution, getOnigWasm success/failure/caching. Uses `vi.hoisted()` + `vi.mock()` for CJS-compatible mocking of `os` and `fs/promises`. All 138 tests pass.

---

### Task 12: Add unit tests for TextMateService ✅

**New file:** `tests/unit/renderer/lib/textmate.test.ts`

**Done:** Added 7 tests covering: initialization with valid grammars (verifies `setTokensProvider` and `hasGrammar`), null onig.wasm handling (loadWASM not called), empty grammars (initialized but no languages wired), `getLanguageForFile` with multiple languages, unknown extension returns null, initialization failure (loadWASM throws, caught gracefully), and idempotent initialization (second call is no-op). Uses `vi.hoisted()` + `vi.mock()` for `monaco-editor`, `vscode-oniguruma`, `vscode-textmate`. Uses `vi.resetModules()` + dynamic import to get fresh singleton per test. All 145 tests pass.

---

### Task 13: Update DiffView tests for TextMate fallback ✅

**File:** `tests/unit/renderer/components/DiffView.test.tsx`

**Done:** Added explicit "falls back to hardcoded map when TextMate has no grammar" test that verifies `grammar.scan` was never called (TextMate uninitialized) and the hardcoded `languageMap` is used instead. All 42 existing language detection tests already exercised this fallback path via the empty grammar mock in `tests/setup.ts`. All 146 tests pass.

---

## Error Handling Summary

| Scenario | Behavior |
|---|---|
| No `~/.vscode/extensions/` | `scan()` returns empty grammars, logs warning |
| `extensions.json` missing/malformed | Returns empty grammars, logs warning |
| Extension `package.json` missing or no `contributes.grammars` | Skip silently |
| Grammar file not found or parse error | Add to `errors[]`, skip that grammar |
| `onig.wasm` not found | `getOnigWasm()` returns null → TextMate disabled |
| `loadWASM` fails | Caught in `initialize()`, Monarch tokenizers used |
| `setTokensProvider` throws for one language | Caught, that language uses Monarch, others continue |

---

## Implementation Order

1. Task 1 — Install deps
2. Task 2 — Shared types
3. Task 3 — GrammarScanner service
4. Task 4 — Grammar IPC handler
5. Task 5 — Register IPC handler
6. Task 6 — Preload bridge
7. Task 7 — TextMateService
8. Task 8 — Initialize at startup
9. Task 9 — Update DiffView
10. Task 10 — Update test mocks
11. Task 11 — GrammarScanner tests
12. Task 12 — TextMateService tests
13. Task 13 — DiffView test updates

---

## Verification

1. Install VSCode with extensions (e.g. Go, Rust, Python)
2. Run `npm run dev`
3. Open a diff for a `.go`, `.rs`, or `.py` file → verify TextMate syntax highlighting
4. Open a `.ts` file → verify existing Monaco Monarch highlighting still works
5. Remove/rename `~/.vscode/extensions/` → verify graceful fallback, no errors
6. Run `npm run test:unit` → all tests pass
