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
    doc.getSafe() >= SAFE_MODE_SAFE
      ? path.resolve(doc.getBaseDir())
      : undefined,
})

/**
 * @param {string} value - Local path or `file://` URI.
 * @param {string} dir - Absolute directory.
 * @returns {boolean} `true` when the path is inside the directory (lexical check, like Asciidoctor).
 */
const isInsideDir = (value, dir) => {
  const resolved = path.resolve(
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
