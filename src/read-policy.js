import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A value of 1 (SAFE) prevents the document from accessing files outside of its base directory
const SAFE_MODE_SAFE = 1

/**
 * @param {string} value - Path or URL.
 * @returns {boolean} `true` for an `http://` or `https://` URL.
 */
const isHttpUrl = (value) => /^https?:\/\//i.test(value)

/**
 * @param {string} value - Local path.
 * @returns {string} Absolute path, in lower case on Windows, where the case of the drive letter varies.
 */
const resolvePath = (value) => {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * Resolves the rules that apply when the extension reads a resource referenced by a document,
 * which are the ones of the `include::` directive: a local file must be inside the base directory
 * when the safe mode is `safe` or higher, and a URL requires the `allow-uri-read` attribute.
 *
 * @param {Object} doc - Asciidoctor document.
 * @returns {{allowUriRead: boolean, jail: string|undefined}}
 */
const resolveReadPolicy = (doc) => ({
  allowUriRead: doc.isAttribute('allow-uri-read'),
  jail:
    doc.getSafe() >= SAFE_MODE_SAFE ? resolvePath(doc.getBaseDir()) : undefined,
})

/**
 * @param {string} value - Local path or `file://` URI.
 * @param {string} dir - Absolute directory.
 * @returns {boolean} `true` when the path is inside the directory (lexical check, like Asciidoctor).
 */
const isInsideDir = (value, dir) => {
  const resolved = resolvePath(
    value.toLowerCase().startsWith('file://') ? fileURLToPath(value) : value,
  )
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`
  return resolved === dir || resolved.startsWith(prefix)
}

/**
 * Wraps a virtual file system, so that a read that is not allowed by the rules of the document
 * logs a warning and fails. The preprocessors handle this failure like any other read error.
 *
 * @template {{read: Function}} T
 * @param {T} vfs - Virtual file system, resolved.
 * @param {Object} doc - Asciidoctor document.
 * @returns {T} A virtual file system that enforces the rules.
 */
export function guardVfs(vfs, doc) {
  const { allowUriRead, jail } = resolveReadPolicy(doc)
  return {
    ...vfs,
    read: async (target, ...args) => {
      let reason
      if (isHttpUrl(target)) {
        if (!allowUriRead) {
          reason = `Unable to read '${target}': the allow-uri-read attribute is not set`
        }
      } else if (jail !== undefined && !isInsideDir(target, jail)) {
        reason = `Unable to read '${target}': the file is outside of the base directory`
      }
      if (reason) {
        doc.getLogger().warn(reason)
        throw new Error(reason)
      }
      return vfs.read(target, ...args)
    },
  }
}

/**
 * @param {Object} doc - Asciidoctor document.
 * @param {string} dir - Directory that the extension is about to write to.
 * @returns {boolean} `true` when the directory is inside the base directory or the output
 *   directory given to the converter.
 */
const isInsideWriteRoot = (doc, dir) => {
  const options = (doc.isNested() ? doc.getParentDocument() : doc).getOptions()
  const roots = [doc.getBaseDir(), options.to_dir]
  if (doc.isAttributeLocked('outdir')) {
    roots.push(doc.getAttribute('outdir'))
  }
  return roots
    .filter(Boolean)
    .some((root) => isInsideDir(dir, resolvePath(root)))
}

/**
 * Checks the directory of the generated images when the safe mode is `safe` or higher. A value
 * set from the API or the CLI is locked, so it cannot come from the document.
 *
 * @param {Object} doc - Asciidoctor document.
 * @param {string} dir - Images output directory, resolved from `imagesoutdir`, `outdir` and `imagesdir`.
 * @returns {boolean} `true` when the extension can write to this directory.
 */
export function isImagesDirAllowed(doc, dir) {
  if (doc.getSafe() < SAFE_MODE_SAFE) {
    return true
  }
  const locked = doc.getAttribute('imagesoutdir')
    ? doc.isAttributeLocked('imagesoutdir')
    : doc.isAttributeLocked('imagesdir') &&
      (!doc.getAttribute('outdir') || doc.isAttributeLocked('outdir'))
  return locked || isInsideWriteRoot(doc, dir)
}

/**
 * Checks the `kroki-cache-dir` attribute when the safe mode is `safe` or higher.
 *
 * @param {Object} doc - Asciidoctor document.
 * @param {string} dir - Value of the attribute.
 * @returns {boolean} `true` when the extension can use this directory.
 */
export function isCacheDirAllowed(doc, dir) {
  return (
    doc.getSafe() < SAFE_MODE_SAFE ||
    doc.isAttributeLocked('kroki-cache-dir') ||
    isInsideWriteRoot(doc, dir)
  )
}

/**
 * Checks a diagram file name that comes from the document before it is written to the output
 * directory, like Asciidoctor does for the paths it resolves when the safe mode is `safe` or higher.
 *
 * @param {Object} doc - Asciidoctor document.
 * @param {string|undefined} target - Diagram file name, without extension.
 * @returns {string|undefined} The file name, or `undefined` when it would be written outside of
 *   the output directory.
 */
export function resolveOutputName(doc, target) {
  if (
    typeof target === 'string' &&
    doc.getSafe() >= SAFE_MODE_SAFE &&
    target.split(/[\\/]/).includes('..')
  ) {
    doc
      .getLogger()
      .warn(
        `kroki: ignoring the diagram file name '${target}', because it is outside of the output directory.`,
      )
    return undefined
  }
  return target
}
