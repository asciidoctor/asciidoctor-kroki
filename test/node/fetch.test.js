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
    const result = await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'foo',
      vfs,
      client,
    )
    assert.strictEqual(result.target, 'foo.svg')
    assert.strictEqual(result.imagesdir, 'images')
    assert.strictEqual(writes.length, 1)
    assert.strictEqual(writes[0].basename, 'foo.svg')
    assert.strictEqual(fetched, 1)
  })

  test('uses a content-addressed diag-<sha256> name when no name is provided', async () => {
    const vfs = { exists: () => false, read: async () => '', add: () => {} }
    const client = createKrokiClient(async () => '<svg/>')
    const uri = 'https://kroki.io/plantuml/svg/AAA'
    const result = await fetch.save(
      createDiagram('svg', uri),
      createDoc(),
      undefined,
      vfs,
      client,
    )
    const hash = createHash('sha256').update(uri).digest('hex')
    assert.strictEqual(result.target, `diag-${hash}.svg`)
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

  test('returns an imagesdir override pointing at imagesoutdir when it diverges from imagesdir (#373)', async () => {
    const writes = []
    const vfs = {
      exists: () => false,
      read: async () => '',
      add: (img) => writes.push(img),
    }
    const client = createKrokiClient(async () => '<svg/>')
    const doc = createDoc({
      attributes: { imagesdir: 'images', imagesoutdir: 'build/kroki' },
    })
    const result = await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'foo',
      vfs,
      client,
    )
    assert.strictEqual(result.target, 'foo.svg')
    // Written to `imagesoutdir`, not to `outdir`/`imagesdir` — the override tells
    // the converter to look there instead of the document's own `imagesdir`.
    assert.strictEqual(writes[0].relative, 'build/kroki')
    assert.strictEqual(result.imagesdir, 'build/kroki')
  })

  test('imagesdir override is a no-op when imagesoutdir is not set', async () => {
    const vfs = { exists: () => false, read: async () => '', add: () => {} }
    const client = createKrokiClient(async () => '<svg/>')
    const doc = createDoc({ attributes: { imagesdir: 'images' } })
    const result = await fetch.save(
      createDiagram('svg', 'https://kroki.io/plantuml/svg/AAA'),
      doc,
      'foo',
      vfs,
      client,
    )
    assert.strictEqual(result.imagesdir, 'images')
  })
})

describe('fetch.toDataUri', () => {
  test('embeds an svg diagram as a base64 data URI, without relying on Buffer', async () => {
    const client = createKrokiClient(async () => '<svg>éÿ</svg>')
    const uri = await fetch.toDataUri(
      createDiagram('svg', 'https://kroki.io/x'),
      client,
    )
    assert.match(uri, /^data:image\/svg\+xml;base64,/)
    const [, base64] = uri.split(',')
    const decoded = Buffer.from(base64, 'base64').toString('binary')
    assert.strictEqual(decoded, '<svg>éÿ</svg>')
  })

  test('embeds a png diagram as a base64 data URI', async () => {
    const client = createKrokiClient(async () => '\x89PNG\r\n\x1a\n')
    const uri = await fetch.toDataUri(
      createDiagram('png', 'https://kroki.io/x'),
      client,
    )
    assert.match(uri, /^data:image\/png;base64,/)
  })

  test('encodes non-ASCII utf8 content correctly (txt/atxt/utxt formats)', async () => {
    const text = 'Ferry: file d’attente distribuée — café ☃'
    const client = createKrokiClient(async () => text)
    const uri = await fetch.toDataUri(
      createDiagram('txt', 'https://kroki.io/x'),
      client,
    )
    assert.match(uri, /^data:text\/plain; charset=utf-8;base64,/)
    const [, base64] = uri.split(',')
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    assert.strictEqual(decoded, text)
  })
})
