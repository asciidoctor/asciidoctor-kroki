import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const shim = (name) => join(__dirname, `test/shims/${name}.js`)

export default defineConfig({
  test: {
    globalSetup: [join(__dirname, 'test/globalSetup.js')],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['shims/setup.js'],
    root: 'test',
    include: ['**/*.test.js'],
    exclude: ['node/**'],
  },
  resolve: {
    alias: [
      { find: 'node:test', replacement: shim('node-test') },
      { find: 'node:assert', replacement: shim('node-assert') },
      { find: 'node:url', replacement: shim('node-url') },
      { find: 'node:path', replacement: shim('node-path') },
      { find: 'node:crypto', replacement: shim('node-crypto') },
      { find: 'node:fs/promises', replacement: shim('node-fs-promises') },
      { find: 'node:fs', replacement: shim('node-fs') },
    ],
  },
})
