import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

const alias = {
  '@': resolve(__dirname, 'src'),
  '@main': resolve(__dirname, 'src/main'),
  '@renderer': resolve(__dirname, 'src/renderer'),
  '@shared': resolve(__dirname, 'src/shared'),
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist/main',
            sourcemap: false,
            rollupOptions: {
              external: ['electron', 'node-pty', 'chokidar', 'simple-git'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          resolve: { alias },
          build: {
            outDir: 'dist/preload',
            sourcemap: false,
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: { alias },
  server: { host: 'localhost' },
  build: {
    outDir: 'dist/renderer',
    sourcemap: false,
  },
})
