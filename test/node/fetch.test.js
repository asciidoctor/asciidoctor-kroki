import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { describe, test } from 'node:test'
import fetch from '../../src/fetch.js'

function createDoc({ attributes = {} } = {}, logger) {
  return {
    isAttribute: (name) => Boolean(attributes[name]),
    getAttribute: (name) => attributes[name],
    isNested: () => false,
    getParentDocument: () => undefined,
    getOptions: () => ({}),
    getBaseDir: () => '.',
    getLogger: () => logger,
  }
}

function createKrokiClient(getImage, serverUrl = 'https://kroki.io') {
  return {
    getServerUrl: () => serverUrl,
    getImage,
  }
}

function createDiagram(format, uri) {
  return {
    format,
    getDiagramUri: () => uri,
  }
}

describe('fetch.save', () => {
  test('uses the explicit name verbatim (no checksum) for stable links', async () => {
    const writes = []
    const vfs = {
      exists: () => false,
      read: async () => '',
      add: (img) => writes.push(img),
    }
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    const doc = createDoc({ attributes: { imagesdir: 'images' } })
    const name = await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'foo',
      vfs,
      client,
    )
    assert.strictEqual(name, 'foo.svg')
    assert.strictEqual(writes.length, 1)
    assert.strictEqual(writes[0].basename, 'foo.svg')
    assert.strictEqual(fetched, 1)
  })

  test('uses a content-addressed diag-<sha256> name when no name is provided', async () => {
    const vfs = { exists: () => false, read: async () => '', add: () => {} }
    const client = createKrokiClient(async () => '<svg/>')
    const uri = 'https://kroki.io/plantuml/svg/AAA'
    const name = await fetch.save(
      createDiagram('svg', uri),
      createDoc(),
      undefined,
      vfs,
      client,
    )
    const hash = createHash('sha256').update(uri).digest('hex')
    assert.strictEqual(name, `diag-${hash}.svg`)
  })

  test('reuses an existing content-addressed file without re-fetching', async () => {
    let fetched = 0
    const vfs = {
      exists: () => true,
      read: async () => '<svg/>',
      add: () => {},
    }
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      createDoc(),
      undefined,
      vfs,
      client,
    )
    assert.strictEqual(fetched, 0)
  })

  test('always re-fetches a named diagram even if a stale file exists', async () => {
    let fetched = 0
    const vfs = { exists: () => true, read: async () => 'STALE', add: () => {} }
    const client = createKrokiClient(async () => {
      fetched++
      return 'FRESH'
    })
    const doc = createDoc({ attributes: { imagesdir: 'images' } })
    await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'foo',
      vfs,
      client,
    )
    assert.strictEqual(fetched, 1)
  })

  test('warns when the same name is reused for a diagram with different content', async () => {
    const warnings = []
    const logger = { warn: (m) => warnings.push(m) }
    const vfs = { exists: () => false, read: async () => '', add: () => {} }
    const client = createKrokiClient(async () => '<svg/>')
    const doc = createDoc({ attributes: { imagesdir: 'images' } }, logger)
    await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'shared',
      vfs,
      client,
    )
    await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/BBB'),
      doc,
      'shared',
      vfs,
      client,
    )
    assert.strictEqual(warnings.length, 1)
    assert.match(warnings[0], /more than one diagram/)
  })

  test('does not warn when the same name maps to the same diagram', async () => {
    const warnings = []
    const logger = { warn: (m) => warnings.push(m) }
    const vfs = { exists: () => false, read: async () => '', add: () => {} }
    const client = createKrokiClient(async () => '<svg/>')
    const doc = createDoc({ attributes: { imagesdir: 'images' } }, logger)
    const uri = 'https://kroki.io/plantuml/svg/AAA'
    await fetch.save(createDiagram('svg', uri), doc, 'shared', vfs, client)
    await fetch.save(createDiagram('svg', uri), doc, 'shared', vfs, client)
    assert.strictEqual(warnings.length, 0)
  })
})
