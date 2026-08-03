import assert from 'node:assert'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import fetch from '../../src/fetch.js'

// The persistent cache (see cache.js) is enabled by default, but these tests are
// about the output-directory/naming logic that predates it, not the cache itself
// (which has its own dedicated describe block below) — so it's disabled by default
// here to avoid touching the real filesystem, and can still be overridden per test.
function createDoc({ attributes = {} } = {}, logger) {
  const merged = { 'kroki-cache': 'false', ...attributes }
  return {
    isAttribute: (name) => Boolean(merged[name]),
    getAttribute: (name) => merged[name],
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

function createDiagram(
  format,
  uri,
  { type = 'plantuml', opts = {}, encode = () => uri } = {},
) {
  return {
    format,
    type,
    opts,
    encode,
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

describe('fetch.save persistent cache', () => {
  let cacheDir

  before(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kroki-fetch-cache-test-'))
  })

  after(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  // createDoc defaults kroki-cache to 'false' (see above); these tests are about the
  // cache itself, so re-enable it by default here and point it at the temp cache dir.
  const createCacheDoc = (attributes = {}) =>
    createDoc({
      attributes: {
        'kroki-cache': 'true',
        'kroki-cache-dir': cacheDir,
        ...attributes,
      },
    })

  // A missing output file (`exists: () => false`) simulates a build that wipes the
  // output directory between runs, e.g. Antora (#113): the persistent cache is the
  // only thing that can still avoid a re-fetch in that case.
  const wipedOutputVfs = () => ({
    exists: () => false,
    read: async () => {
      throw new Error('should not be read: output was wiped')
    },
    add: () => {},
  })

  test('an anonymous diagram is fetched once and served from the persistent cache on a later build', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    const doc = createCacheDoc()
    const diagram = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE1',
      {
        encode: () => 'CACHE1',
      },
    )

    await fetch.save(diagram, doc, undefined, wipedOutputVfs(), client)
    await fetch.save(diagram, doc, undefined, wipedOutputVfs(), client)

    assert.strictEqual(fetched, 1)
  })

  test('a named diagram is fetched once and served from the persistent cache on a later build (#90)', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    const diagram = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE2',
      {
        encode: () => 'CACHE2',
      },
    )

    // A fresh doc each time: the in-run `generatedNamesByDocument` reuse only kicks
    // in within a single conversion, so this isolates the persistent cache's effect.
    await fetch.save(diagram, createCacheDoc(), 'foo', wipedOutputVfs(), client)
    await fetch.save(diagram, createCacheDoc(), 'foo', wipedOutputVfs(), client)

    assert.strictEqual(fetched, 1)
  })

  test('a named diagram whose content changed is re-fetched even with a persistent cache hit for the old content', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    const doc = createCacheDoc()
    const original = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE3A',
      {
        encode: () => 'CACHE3-BEFORE',
      },
    )
    const changed = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE3B',
      {
        encode: () => 'CACHE3-AFTER',
      },
    )

    await fetch.save(original, doc, 'foo', wipedOutputVfs(), client)
    await fetch.save(changed, createCacheDoc(), 'foo', wipedOutputVfs(), client)

    assert.strictEqual(fetched, 2)
  })

  test('kroki-cache: false re-fetches every time even when the same content was cached before', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    })
    const diagram = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE4',
      {
        encode: () => 'CACHE4',
      },
    )

    await fetch.save(
      diagram,
      createCacheDoc(),
      undefined,
      wipedOutputVfs(),
      client,
    )
    await fetch.save(
      diagram,
      createCacheDoc({ 'kroki-cache': 'false' }),
      undefined,
      wipedOutputVfs(),
      client,
    )

    assert.strictEqual(fetched, 2)
  })

  test('kroki-cache: refresh bypasses the cached read but still updates the cache', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return `<svg>${fetched}</svg>`
    })
    const diagram = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE5',
      {
        encode: () => 'CACHE5',
      },
    )

    await fetch.save(
      diagram,
      createCacheDoc(),
      undefined,
      wipedOutputVfs(),
      client,
    )
    await fetch.save(
      diagram,
      createCacheDoc({ 'kroki-cache': 'refresh' }),
      undefined,
      wipedOutputVfs(),
      client,
    )
    // A third, plain read should now see the refreshed content without fetching again.
    let readBackFetched = 0
    const readBackClient = createKrokiClient(async () => {
      readBackFetched++
      return '<svg>should not be fetched</svg>'
    })
    await fetch.save(
      diagram,
      createCacheDoc(),
      undefined,
      wipedOutputVfs(),
      readBackClient,
    )

    assert.strictEqual(fetched, 2)
    assert.strictEqual(readBackFetched, 0)
  })

  test('the cache is host-dependent: the same content on a different server is fetched again', async () => {
    let fetched = 0
    const client = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    }, 'https://kroki.io')
    const otherServerClient = createKrokiClient(async () => {
      fetched++
      return '<svg/>'
    }, 'https://localhost:8000')
    const diagram = createDiagram(
      'svg',
      'https://kroki.io/plantuml/svg/CACHE6',
      {
        encode: () => 'CACHE6',
      },
    )

    await fetch.save(
      diagram,
      createCacheDoc(),
      undefined,
      wipedOutputVfs(),
      client,
    )
    await fetch.save(
      diagram,
      createCacheDoc(),
      undefined,
      wipedOutputVfs(),
      otherServerClient,
    )

    assert.strictEqual(fetched, 2)
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
