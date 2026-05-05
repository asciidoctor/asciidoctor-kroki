import assert from 'node:assert'
import { describe, it } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import pako from 'pako'
import asciidoctorKroki from '../../src/asciidoctor-kroki.js'

function httpGet(uri, encoding = 'utf8') {
  let data = ''
  let status = -1
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', uri, false)
    if (encoding === 'binary') {
      xhr.responseType = 'arraybuffer'
    }
    xhr.addEventListener('load', function () {
      status = this.status
      if (status === 200 || status === 0) {
        if (encoding === 'binary') {
          const arrayBuffer = xhr.response
          const byteArray = new Uint8Array(arrayBuffer)
          for (let i = 0; i < byteArray.byteLength; i++) {
            data += String.fromCharCode(byteArray[i])
          }
        } else {
          data = this.responseText
        }
      }
    })
    xhr.send()
  } catch (e) {
    throw new Error(`Error reading file: ${uri}; reason: ${e.message}`)
  }
  if (status === 404 || !data) {
    throw new Error(`No such file: ${uri}`)
  }
  return data
}

function encodeText(text) {
  const data = Buffer.from(text, 'utf8')
  const compressed = pako.deflate(data, { level: 9 })
  return Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

// In Vitest browser mode, the dev server root is the `test/` directory.
// Fixtures are served at /fixtures/*.
const fixturesBaseUrl = window.location.origin

describe('Conversion', () => {
  describe('When extension is registered', () => {
    it('should convert a diagram to an image', async () => {
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

    it('should convert a diagram with an absolute path to an image', async () => {
      const fixtureUrl = `${fixturesBaseUrl}/fixtures/alice.puml`
      const input = `plantuml::${fixtureUrl}[svg,role=sequence]`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry, {
        vfs: {
          read: (path, encoding = 'utf8') => httpGet(path, encoding),
          exists: () => false,
          add: () => {},
          parse: (path) => ({
            dir: path.substring(0, path.lastIndexOf('/') - 1),
            path,
          }),
        },
      })
      const text = httpGet(fixtureUrl, 'utf8')
      const html = await convert(input, { extension_registry: registry })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(text)}" alt="Diagram">`,
        ),
        `Expected img src not found in:\n${html}`,
      )
    }, 5000)

    it('should convert a diagram with a relative path to an image', async () => {
      const input = 'plantuml::../fixtures/alice.puml[svg,role=sequence]'
      const registry = Extensions.create()
      asciidoctorKroki.register(registry, {
        vfs: {
          read: (path, encoding = 'utf8') => httpGet(path, encoding),
          exists: () => false,
          add: () => {},
          parse: (path) => ({
            dir: path.substring(0, path.lastIndexOf('/') - 1),
            path,
          }),
        },
      })
      const text = httpGet(`${fixturesBaseUrl}/fixtures/alice.puml`, 'utf8')
      const html = await convert(input, { extension_registry: registry })
      assert.ok(
        html.includes(
          `<img src="https://kroki.io/plantuml/svg/${encodeText(text)}" alt="Diagram">`,
        ),
        `Expected img src not found in:\n${html}`,
      )
    }, 5000)
  })
})
