// Minimal process polyfill for browser tests.
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    cwd: () => '/',
    env: {},
    platform: 'browser',
  }
}
