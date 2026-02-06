#!/usr/bin/env node

const { spawn } = require('node:child_process')

const cliPath = require.resolve('@playwright/test/cli')
const args = [cliPath, 'test', ...process.argv.slice(2)]
const env = { ...process.env }

// Playwright may set FORCE_COLOR internally; if NO_COLOR is inherited,
// Node emits a warning about conflicting color env vars.
if ('NO_COLOR' in env) {
  delete env.NO_COLOR
}

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env,
})

child.on('error', (error) => {
  console.error('Failed to start Playwright:', error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
