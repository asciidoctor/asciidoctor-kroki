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

  describe('when kroki-fetch-diagram is set', () => {
    const input = '[plantuml,alice-bob]\n....\nalice -> bob\n....\n'
    const svg = '<svg>héllo</svg>'
    const svgDataUri = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(svg)))}`
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]
    const pngDataUri = `data:image/png;base64,${btoa(String.fromCharCode(...pngBytes))}`
    let savedFetch

    const stubFetch = (body, contentType) => {
      globalThis.fetch = async () =>
        new Response(body, { headers: { 'content-type': contentType } })
    }

    // `kroki-fetch-diagram` is ignored in the default `secure` safe mode.
    const renderFetched = (attributes = {}, source = input) =>
      render(register, source, {
        safe: 'safe',
        attributes: { 'kroki-fetch-diagram': '', ...attributes },
      })

    before(() => {
      savedFetch = globalThis.fetch
    })

    after(() => {
      globalThis.fetch = savedFetch
    })

    test('embeds the diagram as a data URI, since there is no disk', async () => {
      stubFetch(svg, 'image/svg+xml')
      const html = await renderFetched()

      assert.ok(
        html.includes(`<img src="${svgDataUri}" alt="alice-bob">`),
        html,
      )
    })

    for (const attribute of ['data-uri', 'kroki-data-uri']) {
      test(`embeds the diagram as a data URI when ${attribute} is set`, async () => {
        stubFetch(svg, 'image/svg+xml')
        const html = await renderFetched({ [attribute]: '' })

        assert.ok(html.includes(`<img src="${svgDataUri}"`), html)
      })
    }

    test('preserves the bytes of a binary format', async () => {
      stubFetch(new Uint8Array(pngBytes), 'image/png')
      const html = await renderFetched({ 'kroki-default-format': 'png' })

      assert.ok(html.includes(`<img src="${pngDataUri}"`), html)
    })

    test('keeps the diagram source when the server cannot be reached', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch')
      }
      const html = await renderFetched()

      assert.match(html, /class="literalblock kroki-error"/)
      assert.match(html, /alice -&gt; bob/)
    })
  })
})
