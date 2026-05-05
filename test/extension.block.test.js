import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import asciidoctorKroki from '../src/asciidoctor-kroki.js'
import { assertContains } from './node/utils.js'

const krokiServerUrl = 'https://my-kroki-server.example.com'

describe('Conversion', () => {
  test('encodes the diagram in the Kroki URL and reflects format and role in CSS classes', async () => {
    const input = `
[plantuml,alice-bob,png,role=sequence]
....
alice -> bob
....
`
    const registry = Extensions.create()
    asciidoctorKroki.register(registry)
    const html = await convert(input, { extension_registry: registry })
    assert.ok(
      html.includes(
        'https://kroki.io/plantuml/png/eNpLzMlMTlXQtVNIyk8CABoDA90=',
      ),
      `Expected URL not found in:\n${html}`,
    )
    assert.ok(
      html.includes('<div class="imageblock sequence kroki-format-png kroki">'),
      `Expected class not found in:\n${html}`,
    )
  })
  test('uses kroki-server-url as base URL instead of kroki.io', async () => {
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
      attributes: {
        'kroki-server-url': krokiServerUrl,
      },
    })
    assertContains(
      html,
      `${krokiServerUrl}/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=`,
    )
    assertContains(
      html,
      '<div class="imageblock sequence kroki-format-svg kroki">',
    )
  })
})
