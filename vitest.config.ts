import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
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
      exclude: ['src/**/*.d.ts', 'src/main/**/*'],
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
