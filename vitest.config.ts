import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        // Baseline project guardrails
        lines: 65,
        functions: 65,
        statements: 65,
        branches: 55,

        // Highest bar for trust-boundary helpers
        'src/main/security/**/*.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 80,
        },

        // High bar for privileged IPC boundary modules
        'src/main/ipc/**/*.ts': {
          lines: 85,
          functions: 85,
          statements: 85,
          branches: 70,
        },

        // Moderate bar for renderer component/UI paths
        'src/renderer/components/**/*.{ts,tsx}': {
          lines: 60,
          functions: 60,
          statements: 60,
          branches: 45,
        },
      },
    },
    deps: {
      optimizer: {
        client: {
          // Don't try to optimize monaco-editor for tests
          exclude: ['monaco-editor'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      // Mock monaco-editor in tests (Vite 7 can't resolve its entry point)
      'monaco-editor': resolve(__dirname, 'tests/__mocks__/monaco-editor.ts'),
    },
  },
})
