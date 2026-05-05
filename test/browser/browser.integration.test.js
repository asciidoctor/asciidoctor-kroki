import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { inject } from 'vitest'
import asciidoctorKroki from '../../src/asciidoctor-kroki.js'

const krokiUrl = inject('krokiUrl')

describe('Integration with local Kroki server', () => {
  test('converts a plantuml diagram and gets a valid SVG from the local server', async () => {
    const input = `
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob
....
`
    const registry = Extensions.create()
    asciidoctorKroki.register(registry)
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

  test('converts a graphviz diagram and gets a valid SVG from the local server', async () => {
    const input = `
[graphviz,flow,svg]
....
digraph G { A -> B }
....
`
    const registry = Extensions.create()
    asciidoctorKroki.register(registry)
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
})
