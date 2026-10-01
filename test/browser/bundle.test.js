import assert from 'node:assert'
import { after, before, describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { register as registerFromSource } from '../../src/index.js'

// Smoke test of the published browser bundle (package.json `exports["."].browser`),
// built by `pretest:browser`. The other browser tests import `src/` with the shims
// from `vitest.browser.config.js`, whereas the bundle relies on its own stubs from
// `rollup.config.js`: only this test catches a broken or missing bundle stub.
describe('Browser bundle', () => {
  let register
  let savedProcess

  before(async () => {
    // A real browser has no `process` global, but `shims/setup.js` polyfills one.
    savedProcess = globalThis.process
    delete globalThis.process
    // Assembled at runtime so Vite does not resolve (and rewrite) the bundle's imports.
    const bundleUrl = new URL('../../build/browser/index.js', import.meta.url)
    ;({ register } = await import(/* @vite-ignore */ bundleUrl.href))
  })

  after(() => {
    globalThis.process = savedProcess
  })

  const render = async (registerFn, input, options = {}) => {
    const registry = Extensions.create()
    registerFn(registry)
    return convert(input, { ...options, extension_registry: registry })
  }

  test('renders a diagram exactly like the source build', async () => {
    const input = `
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob: héllo
....
`
    const html = await render(register, input)

    assert.match(html, /<img src="https:\/\/kroki\.io\/plantuml\/svg\/[^"]+"/)
    globalThis.process = savedProcess
    try {
      assert.strictEqual(html, await render(registerFromSource, input))
    } finally {
      delete globalThis.process
    }
  })

  test('degrades gracefully when kroki-fetch-diagram is set', async () => {
    // Fetching to a file is not supported in the browser (see fetch.browser.js): the
    // diagram is skipped and its source kept, instead of the conversion failing.
    const html = await render(
      register,
      '[plantuml]\n....\nalice -> bob\n....\n',
      // `kroki-fetch-diagram` is ignored in the default `secure` safe mode.
      { safe: 'safe', attributes: { 'kroki-fetch-diagram': '' } },
    )

    assert.match(html, /class="literalblock kroki-error"/)
    assert.match(html, /alice -&gt; bob/)
  })
})
