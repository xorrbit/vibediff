# Dependency Upgrade Plan

Audit date: 2026-02-06

## Progress

- [x] Phase 1: Fix broken installs (was already resolved)
- [x] Phase 2: Remove electron-icon-builder — **18 → 4 vulns**
- [x] Phase 3: Safe semver updates
- [x] Phase 4: Vite 5→7 + Vitest 1→4 — **4 → 0 vulns**
- [x] Bonus: Fixed xterm test aliases (26/26 suites, 433/433 tests passing)
- [x] Phase 5: ESLint 8→9
- [ ] Phase 6: Monaco 0.45→0.55
- [ ] Phase 7: Chokidar 3→5
- [ ] Phase 8: xterm 5→6
- [ ] Phase 9: React 18→19
- [ ] Phase 10: Tailwind 3→4 (optional)

### Notes from completed phases
- `electron-icon-builder` removed entirely; `scripts/generate-icons.sh` now uses ImageMagick directly
- Vitest 4 requires `function` (not arrow) for constructor mocks (`vi.fn().mockImplementation(function() {...})`)
- Vitest 4 renamed `deps.optimizer.web` → `deps.optimizer.client` in config
- `scripts/run-vitest.cjs` updated: vitest 4 no longer exports `vitest/vitest.mjs` via package exports
- Removed broken xterm aliases from vitest.config.ts (were mapping to nonexistent legacy package names)
- Removed monaco-editor alias; Vite 7 can't resolve monaco-editor entry point natively, so alias to mock file is still needed
- `npm audit` reports **0 vulnerabilities**
- ESLint 9 flat config: `.eslintrc.json` → `eslint.config.mjs`; `@typescript-eslint/*` → unified `typescript-eslint` package; `--ext` flag removed from lint scripts
- eslint-plugin-react-hooks v7 adds many React Compiler rules in `recommended`; manually registered only `rules-of-hooks` + `exhaustive-deps` to maintain parity
- ESLint 9 no longer flags `while (true)` with `no-constant-condition`, so stale disable directives can be removed

---

## Original Summary

- **18 npm vulnerabilities** (2 critical, 1 high, 15 moderate)
- **24 outdated packages** (many with major version bumps available)
- **3 packages MISSING** from node_modules (`@xterm/*` packages)
- **2 packages installed at wrong version** vs package.json (`electron`, `electron-builder`)

---

## Phase 1: Fix Broken Installs (low risk)

The lockfile is out of sync with package.json. Several packages are missing or installed at the wrong version.

### Steps

1. Delete `node_modules` and `package-lock.json`:
   ```sh
   rm -rf node_modules package-lock.json
   ```

2. Reinstall from package.json:
   ```sh
   npm install
   ```

3. Verify the xterm packages are now installed:
   ```sh
   npm ls @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
   ```

4. Verify electron and electron-builder match package.json ranges:
   ```sh
   npm ls electron electron-builder
   ```

5. Run the test suite to confirm nothing broke:
   ```sh
   npm run test:unit
   ```

---

## Phase 2: Remove `electron-icon-builder` (fixes 15 of 18 vulnerabilities)

This single devDependency pulls in `phantomjs-prebuilt` (abandoned), `request` (deprecated), and old `jimp` — accounting for **all critical/high vulns and 13 moderate ones**. It's only used for the `generate-icons` npm script.

### Vulnerabilities eliminated

| Severity | CVE / Advisory | Package |
|----------|---------------|---------|
| Critical | GHSA-fjxv-7rqg-78g4 | form-data <2.5.4 |
| Critical | (transitive) | request * |
| High | GHSA-6rw7-vpxm-498p | qs <6.14.1 |
| Moderate | GHSA-x565-32qp-m3vf | phin <3.7.1 |
| Moderate | GHSA-72xf-g2v4-qvf3 | tough-cookie <4.1.3 |
| Moderate | GHSA-p9pc-299p-vxgp | yargs-parser <=5.0.0 |

### Steps

1. Uninstall the package:
   ```sh
   npm uninstall electron-icon-builder
   ```

2. Remove the `generate-icons` script from `package.json` scripts section:
   ```jsonc
   // Remove this line:
   "generate-icons": "electron-icon-builder --input=resources/icon.png --output=resources --flatten"
   ```

3. Update `scripts/generate-icons.sh` to use ImageMagick directly instead of electron-icon-builder. Replace the Step 2 section (lines 48-51) with direct `convert`/`magick` commands to generate ico/icns from the PNG, or replace with a `sharp`-based Node script. Example replacement using ImageMagick:
   ```sh
   # Generate .ico (Windows) — multiple sizes embedded
   magick resources/icon.png \
     \( -clone 0 -resize 16x16 \) \
     \( -clone 0 -resize 32x32 \) \
     \( -clone 0 -resize 48x48 \) \
     \( -clone 0 -resize 64x64 \) \
     \( -clone 0 -resize 128x128 \) \
     \( -clone 0 -resize 256x256 \) \
     -delete 0 resources/icons/icon.ico

   # Generate PNG sizes for Linux
   for size in 16 32 48 64 128 256 512 1024; do
     magick resources/icon.png -resize ${size}x${size} resources/icons/icon_${size}x${size}.png
   done

   # macOS .icns can be generated with iconutil (macOS only) or png2icns
   ```

4. Verify vulnerabilities are resolved:
   ```sh
   npm audit
   ```

### Alternative

If you still want an npm-based icon tool, consider [`electron-icon-maker`](https://www.npmjs.com/package/electron-icon-maker) or write a small script using `sharp` (already a common transitive dep).

---

## Phase 3: Safe Semver Updates (low risk)

These are within the `^` ranges already specified in package.json.

### Steps

1. Run npm update to pull in latest compatible versions:
   ```sh
   npm update
   ```

2. Verify the following packages updated:
   | Package | From | To |
   |---------|------|----|
   | @playwright/test | 1.58.1 | 1.58.2 |
   | @types/react | 18.3.27 | 18.3.28 |
   | @types/node | 20.19.31 | 22.19.9 |
   | vite-plugin-electron | 0.15.6 | 0.29.0 |

3. Run the test suite:
   ```sh
   npm run test:unit
   ```

---

## Phase 4: Upgrade Vite 5 → 7 + Vitest 1 → 4 (fixes esbuild vulnerability)

This resolves the remaining 3 moderate vulnerabilities (esbuild <=0.24.2 → vite → vitest chain).

### Vulnerabilities eliminated

| Severity | Advisory | Package |
|----------|----------|---------|
| Moderate | GHSA-67mh-4wv8-2f99 | esbuild <=0.24.2 |

### Steps

1. Check the Vite 6 and Vite 7 migration guides:
   - https://vite.dev/guide/migration.html

2. Upgrade vite and its ecosystem plugins:
   ```sh
   npm install vite@^7 @vitejs/plugin-react@^5
   ```

3. Upgrade vitest to match the new vite version:
   ```sh
   npm install -D vitest@^4
   ```

4. Check `vite-plugin-electron` compatibility — this plugin may not yet support Vite 7. Check:
   ```sh
   npm ls vite-plugin-electron
   ```
   If incompatible, check the plugin's repo for a compatible version or alternative.

5. Review `vite.config.ts` for any deprecated options. Key breaking changes to check:
   - Vite 6: `resolve.conditions` default changed; CSS preprocessor APIs updated
   - Vite 7: Node 18 dropped (need Node 20+); `server.allowedHosts` default changed

6. Run the dev server and build to verify:
   ```sh
   npm run dev     # smoke test
   npm run build   # production build
   ```

7. Run full test suite:
   ```sh
   npm run test:unit
   ```

8. Verify audit is clean:
   ```sh
   npm audit
   ```

---

## Phase 5: Upgrade ESLint 8 → 9 + TypeScript-ESLint 6 → 8

ESLint 9 requires "flat config" format. This is a config migration, not a code change.

### Steps

1. Upgrade packages:
   ```sh
   npm install -D eslint@^9 @typescript-eslint/eslint-plugin@^8 @typescript-eslint/parser@^8 eslint-config-prettier@^10 eslint-plugin-react-hooks@^7
   ```

2. Migrate from `.eslintrc.*` to `eslint.config.js` (flat config format). ESLint provides a migration tool:
   ```sh
   npx @eslint/migrate-config .eslintrc.json  # or .eslintrc.js
   ```

3. Update the `lint` scripts in package.json — ESLint 9 no longer uses `--ext`:
   ```jsonc
   // Before:
   "lint": "eslint src --ext .ts,.tsx",
   "lint:fix": "eslint src --ext .ts,.tsx --fix",
   // After:
   "lint": "eslint src",
   "lint:fix": "eslint src --fix",
   ```

4. Run lint and fix any new errors:
   ```sh
   npm run lint
   ```

---

## Phase 6: Upgrade Monaco Editor 0.45 → 0.55

### Steps

1. Upgrade both packages:
   ```sh
   npm install monaco-editor@^0.55 @monaco-editor/react@^4.7
   ```
   Note: Check if `@monaco-editor/react` 4.x supports monaco 0.55. If not, upgrade to the latest `@monaco-editor/react` as well.

2. Review the [Monaco changelog](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md) for breaking changes across 0.45–0.55. Key areas to check:
   - Editor API changes
   - Theme/tokenizer changes (relevant since we use vscode-textmate)
   - Worker configuration changes

3. Test the editor views in the app manually — automated tests may not cover rendering.

4. Run test suite:
   ```sh
   npm run test:unit
   ```

---

## Phase 7: Upgrade Chokidar 3 → 5

Chokidar is used directly in `src/main/services/watcher.ts`.

### Steps

1. Review the chokidar 4/5 migration notes:
   - v4 dropped the `chokidar.watch()` options: `usePolling`, `useFsEvents`, `alwaysStat` behavior changed
   - v4+ is ESM-only — verify Electron main process can handle this or use dynamic `import()`

2. Check current usage:
   ```sh
   grep -r "chokidar" src/
   ```

3. Upgrade:
   ```sh
   npm install chokidar@^5
   ```

4. Update `src/main/services/watcher.ts` for any API changes. The core `watch()` API is mostly the same, but:
   - Constructor options may have changed
   - Event names are the same (`add`, `change`, `unlink`, etc.)
   - The package is now ESM-only — may need `import()` in Electron main process

5. Run watcher-related tests:
   ```sh
   npm run test:unit
   ```

---

## Phase 8: Upgrade xterm 5 → 6

The `@xterm/xterm` package and its addons have a major version bump.

### Steps

1. Upgrade all xterm packages together:
   ```sh
   npm install @xterm/xterm@^6 @xterm/addon-fit@^0.11 @xterm/addon-web-links@^0.12 @xterm/addon-webgl@latest
   ```

2. Review the [xterm.js changelog](https://github.com/xtermjs/xterm.js/releases) for breaking changes v5 → v6:
   - API changes to Terminal constructor
   - Addon loading changes
   - CSS/styling changes

3. Test the terminal component manually and via tests:
   ```sh
   npm run test:unit
   ```

---

## Phase 9: Upgrade React 18 → 19 (largest migration)

This is the highest-effort upgrade. React 19 changes several APIs and patterns.

### Steps

1. Read the React 19 upgrade guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide

2. Upgrade core packages:
   ```sh
   npm install react@^19 react-dom@^19
   npm install -D @types/react@^19 @types/react-dom@^19
   ```

3. Upgrade testing library to match:
   ```sh
   npm install -D @testing-library/react@^16
   ```

4. Key breaking changes to address:
   - `ReactDOM.render()` removed — must use `createRoot()` (check if already migrated)
   - `forwardRef` no longer needed — ref is a regular prop
   - `useContext` returns value directly (minor)
   - Stricter hydration warnings
   - `act()` from `react` instead of `react-dom/test-utils`

5. Search for deprecated patterns:
   ```sh
   grep -r "forwardRef" src/
   grep -r "react-dom/test-utils" src/ tests/
   grep -r "ReactDOM.render" src/
   ```

6. Run full test suite and fix failures:
   ```sh
   npm run test:unit
   ```

---

## Phase 10: Upgrade Tailwind CSS 3 → 4 (optional, high effort)

Tailwind 4 is a ground-up rewrite with a different configuration system. This is optional and can be deferred.

### Key changes

- No more `tailwind.config.js` — configuration moves to CSS with `@theme`
- No more `@tailwind base/components/utilities` directives — use `@import "tailwindcss"`
- Class name changes (some utilities renamed)
- PostCSS plugin configuration changes

### Steps

1. Read the migration guide: https://tailwindcss.com/docs/upgrade-guide

2. Try the automated migration tool:
   ```sh
   npx @tailwindcss/upgrade
   ```

3. Manually verify all component styling after migration.

---

## Recommended Execution Order

| Phase | Effort | Risk | Security Impact |
|-------|--------|------|-----------------|
| 1. Fix broken installs | Low | Low | None (prerequisite) |
| 2. Remove electron-icon-builder | Low | Low | **Fixes 15/18 vulns** |
| 3. Safe semver updates | Low | Low | Patches |
| 4. Vite 5→7 + Vitest 1→4 | Medium | Medium | **Fixes 3/18 vulns** |
| 5. ESLint 8→9 | Medium | Low | None |
| 6. Monaco 0.45→0.55 | Medium | Medium | None |
| 7. Chokidar 3→5 | Medium | Medium | None |
| 8. xterm 5→6 | Medium | Medium | None |
| 9. React 18→19 | High | High | None |
| 10. Tailwind 3→4 | High | Medium | None (optional) |

Phases 1-3 should be done first and together — they're quick wins. Phase 4 resolves all remaining vulnerabilities. Phases 5-10 are modernization and can be done incrementally.

After completing Phases 1-4, `npm audit` should report **0 vulnerabilities**.
