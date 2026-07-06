import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions, MemoryLogger } from '@asciidoctor/core'
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
  test('logs a warning with the source location when a diagram block cannot be rendered', async () => {
    const input = `before

[plantuml,diag,txt]
....
alice -> bob
....
`
    const registry = Extensions.create()
    asciidoctorKroki.register(registry)
    const memoryLogger = MemoryLogger.create()
    const html = await convert(input, {
      extension_registry: registry,
      logger: memoryLogger,
      // Unreachable server so getTextContent() fails deterministically offline.
      attributes: { 'kroki-server-url': 'http://127.0.0.1:1/invalid' },
    })
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.strictEqual(logs[0].getSeverity(), 'WARN')
    assert.match(logs[0].getText(), /^Skipping plantuml block: /)
    // The source location points at the diagram content (line 5 of the input).
    assert.strictEqual(String(logs[0].getSourceLocation()), '<stdin>: line 5')
    // The message renders the location inline when formatted by a stderr logger.
    assertContains(
      logs[0].message.toString(),
      '<stdin>: line 5: Skipping plantuml block: ',
    )
    // The block is still emitted, tagged with the kroki-error role.
    assertContains(html, 'kroki-error')
  })
})
