import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { register } from '../../src/index.js'

describe('Block macro with a remote target', () => {
  const alice = readFileSync('test/fixtures/alice.puml')
  let server
  let baseUrl
  let requests = 0

  before(async () => {
    server = createServer((_req, res) => {
      requests++
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(alice)
    })
    await new Promise((resolve) => server.listen(0, 'localhost', resolve))
    baseUrl = `http://localhost:${server.address().port}`
  })

  after(() => server.close())

  const render = (input, attributes = {}) => {
    const registry = Extensions.create()
    register(registry)
    return convert(input, {
      safe: 'safe',
      extension_registry: registry,
      attributes,
    })
  }

  test('reads the remote target when allow-uri-read is set', async () => {
    const expected = await render(
      'plantuml::test/fixtures/alice.puml[svg,role=sequence]',
    )
    const html = await render(
      `plantuml::${baseUrl}/alice.puml[svg,role=sequence]`,
      { 'allow-uri-read': '' },
    )
    assert.ok(html.includes('kroki.io/plantuml/svg/'), html)
    assert.strictEqual(html, expected)
  })

  test('renders a link to the remote target when allow-uri-read is not set', async () => {
    const count = requests
    const html = await render(`plantuml::${baseUrl}/alice.puml[svg]`)
    assert.strictEqual(
      html,
      `<div class="paragraph">
<p><a href="${baseUrl}/alice.puml">${baseUrl}/alice.puml</a></p>
</div>`,
    )
    assert.strictEqual(requests, count, 'the remote target must not be read')
  })
})
