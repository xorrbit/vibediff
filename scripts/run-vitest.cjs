#!/usr/bin/env node

const { spawn } = require('node:child_process')

const path = require('node:path')

const cliPath = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
const args = [cliPath, 'run', ...process.argv.slice(2)]

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error('Failed to start Vitest:', error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
