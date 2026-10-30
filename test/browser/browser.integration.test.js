import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { inject } from 'vitest'
import { register } from '../../src/index.js'

const krokiUrl = inject('krokiUrl')

describe('Integration with local Kroki server', () => {
  test('fetches valid SVG from the Kroki server for a PlantUML diagram', async () => {
    const input = `
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob
....
`
    const registry = Extensions.create()
    register(registry)
    const html = await convert(input, {
      extension_registry: registry,
      attributes: { 'kroki-server-url': krokiUrl },
    })

    assert.ok(
      html.includes(krokiUrl),
      `Expected local Kroki URL not found in:\n${html}`,
    )

    const match = html.match(/src="([^"]+)"/)
    assert.ok(match, `No img src found in:\n${html}`)

    const response = await fetch(match[1])
    assert.strictEqual(response.status, 200)
    const svg = await response.text()
    assert.ok(
      svg.includes('<svg'),
      `Response is not valid SVG:\n${svg.slice(0, 200)}`,
    )
  })

  test('fetches valid SVG from the Kroki server for a Graphviz diagram', async () => {
    const input = `
[graphviz,flow,svg]
....
digraph G { A -> B }
....
`
    const registry = Extensions.create()
    register(registry)
    const html = await convert(input, {
      extension_registry: registry,
      attributes: { 'kroki-server-url': krokiUrl },
    })

    assert.ok(
      html.includes(krokiUrl),
      `Expected local Kroki URL not found in:\n${html}`,
    )

    const match = html.match(/src="([^"]+)"/)
    assert.ok(match, `No img src found in:\n${html}`)

    const response = await fetch(match[1])
    assert.strictEqual(response.status, 200)
    const svg = await response.text()
    assert.ok(
      svg.includes('<svg'),
      `Response is not valid SVG:\n${svg.slice(0, 200)}`,
    )
  })

  test('embeds a data URI fetched from the Kroki server with the bundle when kroki-fetch-diagram is set', async () => {
    // Assembled at runtime so Vite does not resolve (and rewrite) the bundle's imports.
    const bundleUrl = new URL('../../build/browser/index.js', import.meta.url)
    const { register: registerBundle } = await import(
      /* @vite-ignore */ bundleUrl.href
    )
    const registry = Extensions.create()
    registerBundle(registry)
    const html = await convert('[plantuml]\n....\nalice -> bob\n....\n', {
      extension_registry: registry,
      safe: 'safe',
      attributes: {
        'kroki-server-url': krokiUrl,
        'kroki-fetch-diagram': '',
        'data-uri': '',
      },
    })

    const match = html.match(/src="data:image\/svg\+xml;base64,([^"]+)"/)
    assert.ok(match, `No data URI found in:\n${html}`)
    assert.ok(
      atob(match[1]).includes('<svg'),
      `Data URI is not valid SVG:\n${atob(match[1]).slice(0, 200)}`,
    )
  })
})
