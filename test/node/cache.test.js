import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import {
  contentKey,
  existsInCache,
  readFromCache,
  resolveCacheDir,
  resolveCacheMode,
  writeToCache,
} from '../../src/cache.js'

function createDoc(attributes = {}, logger) {
  return {
    getAttribute: (name) => attributes[name],
    getLogger: () => logger,
  }
}

function createDiagram(type, format, encoded, opts = {}) {
  return { type, format, opts, encode: () => encoded }
}

describe('resolveCacheDir', () => {
  const originalXdgCacheHome = process.env.XDG_CACHE_HOME

  after(() => {
    if (originalXdgCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome
    }
  })

  test('uses the kroki-cache-dir attribute when set', () => {
    const doc = createDoc({ 'kroki-cache-dir': '/tmp/my-cache' })
    assert.strictEqual(resolveCacheDir(doc), '/tmp/my-cache')
  })

  test('defaults to $XDG_CACHE_HOME/kroki when set', () => {
    process.env.XDG_CACHE_HOME = '/tmp/xdg-cache'
    assert.strictEqual(resolveCacheDir(createDoc()), '/tmp/xdg-cache/kroki')
  })

  test('defaults to ~/.cache/kroki when XDG_CACHE_HOME is unset', () => {
    delete process.env.XDG_CACHE_HOME
    assert.strictEqual(
      resolveCacheDir(createDoc()),
      path.join(os.homedir(), '.cache', 'kroki'),
    )
  })
})

describe('resolveCacheMode', () => {
  test('is enabled and not refreshing by default (attribute unset)', () => {
    assert.deepStrictEqual(resolveCacheMode(createDoc()), {
      enabled: true,
      refresh: false,
    })
  })

  test('is enabled when set with no value (kroki-cache attribute present, empty string)', () => {
    assert.deepStrictEqual(resolveCacheMode(createDoc({ 'kroki-cache': '' })), {
      enabled: true,
      refresh: false,
    })
  })

  test('is enabled when explicitly set to true', () => {
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': 'true' })),
      { enabled: true, refresh: false },
    )
  })

  test('is disabled when set to false', () => {
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': 'false' })),
      { enabled: false, refresh: false },
    )
  })

  test('is enabled and refreshing when set to refresh', () => {
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': 'refresh' })),
      { enabled: true, refresh: true },
    )
  })

  test('is case-insensitive and trims surrounding whitespace', () => {
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': ' REFRESH ' })),
      { enabled: true, refresh: true },
    )
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': 'FALSE' })),
      { enabled: false, refresh: false },
    )
  })

  test('warns and falls back to enabled for an invalid value', () => {
    const warnings = []
    const logger = { warn: (m) => warnings.push(m) }
    assert.deepStrictEqual(
      resolveCacheMode(createDoc({ 'kroki-cache': 'yes' }, logger)),
      { enabled: true, refresh: false },
    )
    assert.strictEqual(warnings.length, 1)
    assert.match(warnings[0], /Invalid value 'yes' for kroki-cache attribute/)
  })
})

describe('contentKey', () => {
  test('is stable regardless of options insertion order', () => {
    const a = createDiagram('plantuml', 'svg', 'ENC', { a: '1', b: '2' })
    const b = createDiagram('plantuml', 'svg', 'ENC', { b: '2', a: '1' })
    assert.strictEqual(
      contentKey(a, 'https://kroki.io'),
      contentKey(b, 'https://kroki.io'),
    )
  })

  test('differs when the server URL differs (host-dependent by design)', () => {
    const diagram = createDiagram('plantuml', 'svg', 'ENC')
    assert.notStrictEqual(
      contentKey(diagram, 'https://kroki.io'),
      contentKey(diagram, 'https://localhost:8000'),
    )
  })

  test('differs when the encoded source differs', () => {
    const a = createDiagram('plantuml', 'svg', 'ENC-A')
    const b = createDiagram('plantuml', 'svg', 'ENC-B')
    assert.notStrictEqual(
      contentKey(a, 'https://kroki.io'),
      contentKey(b, 'https://kroki.io'),
    )
  })

  test('differs when an option value differs', () => {
    const a = createDiagram('plantuml', 'svg', 'ENC', { theme: 'light' })
    const b = createDiagram('plantuml', 'svg', 'ENC', { theme: 'dark' })
    assert.notStrictEqual(
      contentKey(a, 'https://kroki.io'),
      contentKey(b, 'https://kroki.io'),
    )
  })
})

describe('existsInCache / readFromCache / writeToCache', () => {
  let cacheDir

  before(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kroki-cache-test-'))
  })

  after(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  test('a key that was never written does not exist', () => {
    assert.strictEqual(existsInCache(cacheDir, 'missing', 'svg'), false)
  })

  test('round-trips a written diagram', () => {
    writeToCache(cacheDir, 'abc123', 'svg', '<svg/>', 'binary')
    assert.strictEqual(existsInCache(cacheDir, 'abc123', 'svg'), true)
    assert.strictEqual(
      readFromCache(cacheDir, 'abc123', 'svg', 'binary'),
      '<svg/>',
    )
  })

  test('creates the cache directory when it does not exist yet', () => {
    const nested = path.join(cacheDir, 'nested', 'dir')
    writeToCache(nested, 'def456', 'png', 'PNGDATA', 'binary')
    assert.strictEqual(existsInCache(nested, 'def456', 'png'), true)
  })

  test('the same key with a different format is a different cache entry', () => {
    writeToCache(cacheDir, 'shared-key', 'svg', 'SVG', 'binary')
    writeToCache(cacheDir, 'shared-key', 'png', 'PNG', 'binary')
    assert.strictEqual(
      readFromCache(cacheDir, 'shared-key', 'svg', 'binary'),
      'SVG',
    )
    assert.strictEqual(
      readFromCache(cacheDir, 'shared-key', 'png', 'binary'),
      'PNG',
    )
  })
})
