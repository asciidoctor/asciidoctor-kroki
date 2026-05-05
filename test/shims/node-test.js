import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe as vitestDescribe,
  test as vitestTest,
} from 'vitest'

// Patterns indicating the test failed due to browser-incompatible behavior.
// Some errors are thrown directly (msg), others are swallowed by Asciidoctor
// internals and only surface in the assertion's actual value (actual).
function isBrowserIncompatible(err) {
  const msg = String(err?.message || '')
  const actual = String(err?.actual || '')
  return (
    // Direct errors from our node:* shims
    msg.includes('not supported in browser environments') ||
    // Include file not found (logged by Asciidoctor, checked in assertion message)
    msg.includes('include file not found') ||
    // Include directive failure: actual output contains "Unresolved directive"
    actual.includes('Unresolved directive in') ||
    // SVG/image file cannot be read (logged by Asciidoctor)
    actual.includes('does not exist or cannot be read') ||
    msg.includes('does not exist or cannot be read')
  )
}

function wrapForBrowser(fn) {
  if (!fn) return fn
  return async (ctx) => {
    try {
      await fn(ctx)
    } catch (err) {
      if (isBrowserIncompatible(err)) ctx.skip()
      throw err
    }
  }
}

export const test = Object.assign(function test(name, fn, options) {
  return vitestTest(name, wrapForBrowser(fn), options)
}, vitestTest)

export const it = test

export function describe(name, optionsOrFn, maybeFn) {
  const [options, fn] =
    typeof optionsOrFn === 'function'
      ? [undefined, optionsOrFn]
      : [optionsOrFn, maybeFn]
  return vitestDescribe(name, options ?? {}, () => {
    try {
      fn()
    } catch (err) {
      if (isBrowserIncompatible(err)) {
        vitestTest.skip(`${name} (skipped: browser-incompatible setup)`)
        return
      }
      throw err
    }
  })
}

export { afterEach, beforeEach }
export const before = beforeAll
export const after = afterAll
