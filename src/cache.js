import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * Resolves the persistent cache directory.
 * Uses the `kroki-cache-dir` attribute when set; otherwise defaults to the
 * XDG cache directory (`$XDG_CACHE_HOME/kroki` or `~/.cache/kroki`).
 *
 * @param {Object} doc - Asciidoctor document.
 * @returns {string} Absolute path to the cache directory.
 */
export const resolveCacheDir = (doc) => {
  const configured = doc.getAttribute('kroki-cache-dir')
  if (configured) {
    return configured
  }
  const xdgCacheHome =
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
  return path.join(xdgCacheHome, 'kroki')
}

/** @type {Set<string>} Recognised `kroki-cache` attribute values (case-insensitive). */
const VALID_CACHE_MODES = new Set(['', 'true', 'false', 'refresh'])

/**
 * Resolves the `kroki-cache` attribute into a cache mode.
 *
 * Recognised values are: unset (defaults to enabled), `` (set with no value, e.g.
 * `:kroki-cache:`) and `true` (both enabled), `false` (disabled), and `refresh`
 * (enabled, but bypasses cached reads and re-fetches + updates the cache). Any
 * other value is invalid: it is logged and treated as if unset.
 *
 * @param {Object} doc - Asciidoctor document.
 * @returns {{enabled: boolean, refresh: boolean}}
 */
export const resolveCacheMode = (doc) => {
  const raw = doc.getAttribute('kroki-cache')
  if (raw === undefined || raw === null) {
    return { enabled: true, refresh: false }
  }
  const value = raw.toString().trim().toLowerCase()
  if (!VALID_CACHE_MODES.has(value)) {
    doc
      .getLogger()
      .warn(
        `Invalid value '${raw}' for kroki-cache attribute. The value must be either: 'true', 'false' or 'refresh'. Proceeding using: 'true'.`,
      )
    return { enabled: true, refresh: false }
  }
  return { enabled: value !== 'false', refresh: value === 'refresh' }
}

/**
 * Computes the content-addressed cache key for a diagram.
 *
 * Deliberately host-dependent: the server URL is part of the key because two
 * Kroki servers are not guaranteed to render the same source identically
 * (they may run different versions of the underlying diagram libraries).
 * Options are sorted so the key does not depend on their insertion order.
 *
 * @param {import('./kroki-client.js').KrokiDiagram} krokiDiagram - Diagram to key.
 * @param {string} serverUrl - Kroki server URL the diagram would be fetched from.
 * @returns {string} Hexadecimal SHA-256 digest identifying this diagram request.
 */
export const contentKey = (krokiDiagram, serverUrl) => {
  const sortedOpts = Object.entries(krokiDiagram.opts).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const material = [
    serverUrl,
    krokiDiagram.type,
    krokiDiagram.format,
    krokiDiagram.encode(),
    JSON.stringify(sortedOpts),
  ].join('/')
  return createHash('sha256').update(material).digest('hex')
}

/**
 * Resolves the path of the cached file for a given key and format.
 *
 * @param {string} cacheDir - Cache directory (see {@link resolveCacheDir}).
 * @param {string} key - Content key (see {@link contentKey}).
 * @param {string} format - Diagram output format (e.g. `svg`, `png`), used as the file extension.
 * @returns {string} Absolute path to the cached file.
 */
const cacheFilePath = (cacheDir, key, format) =>
  path.join(cacheDir, `${key}.${format}`)

/**
 * Whether a diagram is already present in the cache.
 *
 * @param {string} cacheDir - Cache directory.
 * @param {string} key - Content key.
 * @param {string} format - Diagram output format.
 * @returns {Promise<boolean>}
 */
export const existsInCache = async (cacheDir, key, format) => {
  try {
    await access(cacheFilePath(cacheDir, key, format))
    return true
  } catch {
    return false
  }
}

/**
 * Reads a cached diagram.
 *
 * @param {string} cacheDir - Cache directory.
 * @param {string} key - Content key.
 * @param {string} format - Diagram output format.
 * @param {BufferEncoding} encoding - Encoding used to read the cached content back as a string.
 * @returns {Promise<string>} Cached diagram content.
 */
export const readFromCache = (cacheDir, key, format, encoding) =>
  readFile(cacheFilePath(cacheDir, key, format), encoding)

/**
 * Writes a diagram to the cache, creating the cache directory if needed.
 *
 * @param {string} cacheDir - Cache directory.
 * @param {string} key - Content key.
 * @param {string} format - Diagram output format.
 * @param {string} contents - Diagram content to cache.
 * @param {BufferEncoding} encoding - Encoding used to write the content.
 * @returns {Promise<void>}
 */
export const writeToCache = async (
  cacheDir,
  key,
  format,
  contents,
  encoding,
) => {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(cacheFilePath(cacheDir, key, format), contents, encoding)
}
