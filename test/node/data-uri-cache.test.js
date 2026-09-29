import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { register } from '../../src/index.js'

test('embedded diagrams use the persistent cache', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kroki-embedded-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const cacheDir = path.join(dir, 'cache')
  const mime = 'image/svg+xml'
  // Distinct responses expose stale cache hits; non-ASCII text checks byte preservation.
  const images = [0, 1, 2, 3, 4, 5].map((version) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><text>Été → ${version}</text></svg>`,
    ),
  )
  const requests = []
  const server = createServer((req, res) => {
    req.resume()
    requests.push(req.method)
    res.writeHead(200, { 'Content-Type': mime })
    res.end(images[requests.length - 1])
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}`
  // Every call creates a new registry and document: only disk state survives.
  const render = async ({
    source = 'Alice -> Bob',
    option = 'false',
    mode,
    embedded = true,
    attribute = 'data-uri',
  } = {}) => {
    const registry = Extensions.create()
    register(registry, {
      vfs: embedded
        ? {
            exists: async () =>
              assert.fail('embedded output must not check output files'),
            read: async () =>
              assert.fail('embedded output must not read output files'),
            add: async () =>
              assert.fail('embedded output must not write output files'),
          }
        : undefined,
    })
    return convert(
      `[plantuml,example,svg,monochrome=${option}]\n----\n${source}\n----`,
      {
        safe: 'safe',
        extension_registry: registry,
        attributes: {
          'kroki-fetch-diagram': '',
          'kroki-server-url': url,
          'kroki-http-method': 'get',
          'kroki-cache-dir': cacheDir,
          imagesoutdir: path.join(dir, 'images'),
          ...(embedded ? { [attribute]: '' } : {}),
          ...(mode ? { 'kroki-cache': mode } : {}),
        },
      },
    )
  }
  const assertImage = (html, expected) => {
    const match = html.match(/src="data:([^;]+);base64,([^"]+)"/)
    assert.ok(match, html)
    assert.equal(match[1], mime)
    assert.deepEqual(Buffer.from(match[2], 'base64'), expected)
  }

  // The first conversion fetches and caches the image, without writing an output image.
  assertImage(await render(), images[0])
  assert.equal(requests.length, 1)
  assert.equal((await fs.readdir(cacheDir)).length, 1)
  assert.deepEqual(await fs.readdir(dir), ['cache'])

  // An independent conversion using the other data-URI attribute reuses the disk cache.
  assertImage(await render({ attribute: 'kroki-data-uri' }), images[0])
  assert.equal(requests.length, 1)

  // Changing either the source or a rendering option must fetch a distinct image.
  assertImage(await render({ source: 'Bob -> Carol' }), images[1])
  assertImage(await render({ option: 'true' }), images[2])
  assert.equal(requests.length, 3)
  assert.equal(requests[0], 'GET')

  // Disabling the cache bypasses reads and writes, leaving the original entry intact.
  assertImage(await render({ mode: 'false' }), images[3])
  assertImage(await render(), images[0])
  assert.equal(requests.length, 4)

  // Refresh fetches new bytes and replaces the original entry rather than adding one.
  assertImage(await render({ mode: 'refresh' }), images[4])
  assert.equal(requests.length, 5)
  assert.equal((await fs.readdir(cacheDir)).length, 3)

  // Populate an entry using the unchanged linked-image cache writer.
  await render({ source: 'Carol -> Dave', embedded: false })
  assert.equal(requests.length, 6)
  await new Promise((resolve) => server.close(resolve))
  // Cached requests still work with the server stopped, including changed inputs.
  assertImage(await render({ source: 'Carol -> Dave' }), images[5])
  assertImage(await render(), images[4])
  assertImage(await render({ source: 'Bob -> Carol' }), images[1])
  assertImage(await render({ option: 'true' }), images[2])
  // Linked output consumes the same cache, then remains reusable when embedded.
  await render({ embedded: false })
  assert.deepEqual(
    await fs.readFile(path.join(dir, 'images', 'example.svg')),
    images[4],
  )
  assertImage(await render(), images[4])
  assert.equal(requests.length, 6)
})
