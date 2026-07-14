import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import http from './http-client.js'

/**
 * Descriptor for a diagram image to be persisted by {@link Vfs#add}.
 *
 * @typedef {Object} VfsImage
 * @property {string} relative - Directory (relative or absolute) where the file should be written.
 * @property {string} basename - File name including extension.
 * @property {string} mediaType - MIME type of the image (e.g. `image/svg+xml`, `image/png`).
 * @property {Buffer} contents - Raw file contents.
 */

/**
 * Virtual filesystem interface that abstracts file I/O for both Node.js and browser environments.
 * Pass a custom implementation to the Asciidoctor extension to redirect reads and writes
 * (e.g. to an in-memory store or a bundler's asset pipeline).
 * Any method that is omitted falls back to the Node.js implementation provided by {@link nodefs}.
 *
 * @typedef {Object} Vfs
 * @property {(image: VfsImage) => void} add
 *   Persists a rendered diagram image. The Node.js default creates the target directory
 *   recursively and writes the file synchronously.
 * @property {(path: string) => boolean} exists
 *   Returns `true` when the file at the given path already exists, allowing the extension
 *   to skip a Kroki network request for previously generated diagrams.
 * @property {(path: string, encoding?: BufferEncoding, resource?: {[key: string]: string}) => Promise<string>} read
 *   Reads a file and returns its contents. Accepts local filesystem paths, `file://` URIs,
 *   and `http://`/`https://` URLs (fetched via the built-in HTTP client).
 *   Custom implementations may use the optional `resource` (diagram resource identity,
 *   e.g. an Antora resource id) to resolve the path.
 * @property {(resourceId: string, resource?: {[key: string]: string}) => {dir: string, path: string}} parse
 *   Parses a resource identifier into its directory and full path components.
 *   Backslashes are normalised to forward slashes so that path.posix operations
 *   work correctly on Windows.
 */

/**
 * Default Node.js virtual filesystem implementation backed by `node:fs`.
 *
 * @type {Vfs}
 */
const nodefs = {
  /**
   * Creates the target directory (recursively) and writes the image file synchronously.
   *
   * @param {VfsImage} image - Image descriptor.
   */
  add: (image) => {
    fs.mkdirSync(image.relative, { recursive: true })
    const filePath = path.format({ dir: image.relative, base: image.basename })
    fs.writeFileSync(filePath, image.contents, 'binary')
  },

  /**
   * Returns `true` when the file at `path` exists on the local filesystem.
   *
   * @param {string} path - Local filesystem path to check.
   * @returns {boolean}
   */
  exists: (path) => {
    return fs.existsSync(path)
  },

  /**
   * Reads a file and returns its contents with the given encoding.
   * Supports `http://` and `https://` URLs (delegated to the HTTP client),
   * `file://` URIs, and plain filesystem paths.
   *
   * @param {string} path - File path, `file://` URI, or HTTP(S) URL.
   * @param {BufferEncoding} [encoding='utf8'] - Encoding for the returned content.
   * @returns {Promise<string>} File contents.
   */
  read: async (path, encoding = 'utf8') => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return http.get(path, {}, encoding)
    }
    if (path.startsWith('file://')) {
      return fs.readFileSync(url.fileURLToPath(path), encoding)
    }
    return fs.readFileSync(path, encoding)
  },

  /**
   * Parses a resource identifier into its directory and normalised path.
   * Backslashes are converted to forward slashes so that `path.posix` operations
   * in `preprocess.js` work correctly on Windows.
   *
   * @param {string} resourceId - File path or resource identifier to parse.
   * @returns {{dir: string, path: string}} Parsed path components.
   */
  parse: (resourceId) => {
    // Normalize backslashes to forward slashes so that preprocess.js,
    // which uses path.posix throughout, can join and resolve paths correctly
    // on Windows (posix treats backslashes as literal characters, not separators).
    const normalized = resourceId.replace(/\\/g, '/')
    return {
      dir: path.posix.dirname(normalized),
      path: normalized,
    }
  },
}

/**
 * Resolves a complete {@link Vfs} implementation by merging the provided `vfs` object
 * with {@link nodefs} fallbacks for any missing methods.
 *
 * @param {Partial<Vfs>|undefined} vfs - Custom VFS implementation, or `undefined` to use Node.js defaults entirely.
 * @returns {Vfs} A fully-resolved VFS with all four methods defined.
 */
export function resolveVfs(vfs) {
  return {
    read: typeof vfs?.read === 'function' ? vfs.read : nodefs.read,
    exists: typeof vfs?.exists === 'function' ? vfs.exists : nodefs.exists,
    parse: typeof vfs?.parse === 'function' ? vfs.parse : nodefs.parse,
    add: typeof vfs?.add === 'function' ? vfs.add : nodefs.add,
  }
}

export default nodefs
