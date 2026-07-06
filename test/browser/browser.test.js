import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import pako from 'pako'
import asciidoctorKroki from '../../src/asciidoctor-kroki.js'

async function fetchGet(uri, encoding = 'utf8') {
  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(`No such file: ${uri}`)
  }
  if (encoding === 'binary') {
    const arrayBuffer = await response.arrayBuffer()
    const byteArray = new Uint8Array(arrayBuffer)
    let data = ''
    for (let i = 0; i < byteArray.byteLength; i++) {
      data += String.fromCharCode(byteArray[i])
    }
    if (!data) {
      throw new Error(`No such file: ${uri}`)
    }
    return data
  }
  const text = await response.text()
  if (!text) {
    throw new Error(`No such file: ${uri}`)
  }
  return text
}

// Buffer-free encoding: a real browser (vscode.dev) has no `Buffer` global, and the
// browser test setup no longer polyfills it, so this must rely on TextEncoder/btoa.
function encodeText(text) {
  const bytes = new TextEncoder().encode(text)
  const compressed = pako.deflate(bytes, { level: 9 })
  let binary = ''
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}

// In Vitest browser mode, the dev server root is the `test/` directory.
// Fixtures are served at /fixtures/*.
const fixturesBaseUrl = window.location.origin

describe('Conversion', () => {
  describe('When extension is registered', () => {
    test('generates a kroki.io URL for an inline PlantUML block', async () => {
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
        html.includes(
          '<div class="imageblock sequence kroki-format-png kroki">',
        ),
        `Expected class not found in:\n${html}`,
      )
    })

    test('reads a block macro file via the custom VFS and encodes it in the Kroki URL', async () => {
      const fixtureUrl = `${fixturesBaseUrl}/fixtures/alice.puml`
      const input = `plantuml::${fixtureUrl}[svg,role=sequence]`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry, {
        vfs: {
          read: (path, encoding = 'utf8') => fetchGet(path, encoding),
          exists: () => false,
          add: () => {},
          parse: (path) => ({
            dir: path.substring(0, path.lastIndexOf('/') - 1),
            path,
          }),
        },
      })
      const text = await fetchGet(fixtureUrl, 'utf8')
      const html = await convert(input, { extension_registry: registry })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(text)}" alt="Diagram">`,
        ),
        `Expected img src not found in:\n${html}`,
      )
    }, 5000)

    test('resolves a block macro relative URL using the custom VFS', async () => {
      const input = 'plantuml::../fixtures/alice.puml[svg,role=sequence]'
      const registry = Extensions.create()
      asciidoctorKroki.register(registry, {
        vfs: {
          read: (path, encoding = 'utf8') => fetchGet(path, encoding),
          exists: () => false,
          add: () => {},
          parse: (path) => ({
            dir: path.substring(0, path.lastIndexOf('/') - 1),
            path,
          }),
        },
      })
      const text = await fetchGet(
        `${fixturesBaseUrl}/fixtures/alice.puml`,
        'utf8',
      )
      const html = await convert(input, { extension_registry: registry })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(text)}" alt="Diagram">`,
        ),
        `Expected img src not found in:\n${html}`,
      )
    }, 5000)

    test('reads a block macro file using the default fetch-based VFS', async () => {
      const fixtureUrl = `${fixturesBaseUrl}/fixtures/alice.puml`
      const input = `plantuml::${fixtureUrl}[svg,role=sequence]`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const text = await fetchGet(fixtureUrl, 'utf8')
      const html = await convert(input, { extension_registry: registry })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(text)}" alt="Diagram">`,
        ),
        `Expected img src not found in:\n${html}`,
      )
    }, 5000)

    test('inlines relative !include paths in a block macro loaded via the default fetch-based VFS', async () => {
      // alice-with-styles.puml contains: !include styles/general.iuml
      // The default browser VFS must resolve that relative path against the parent file's directory.
      const parentUrl = `${fixturesBaseUrl}/fixtures/plantuml/alice-with-styles.puml`
      const input = `plantuml::${parentUrl}[svg,role=sequence]`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const stylesText = await fetchGet(
        `${fixturesBaseUrl}/fixtures/plantuml/styles/general.iuml`,
      )
      const expectedDiagramText = `${stylesText}\nalice -> bob`
      const html = await convert(input, {
        extension_registry: registry,
        safe: 'unsafe',
      })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(expectedDiagramText)}" alt="Diagram">`,
        ),
        `Expected relative !include to be inlined in the Kroki URL.\nGot:\n${html}`,
      )
    }, 5000)
  })
})
