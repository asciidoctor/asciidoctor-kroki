import fs from 'node:fs'

/**
 * Kroki image used by the tests that need a real Kroki server.
 * The version is shared with the Ruby test suite (see .kroki-version).
 */
export const KROKI_IMAGE = `yuzutech/kroki:${fs.readFileSync(new URL('../.kroki-version', import.meta.url), 'utf8').trim()}`
