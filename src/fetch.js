import { createHash } from 'node:crypto'
import { posix as path } from 'node:path'
import { resolveVfs } from './node-fs.js'

/**
 * Resolves the directory where generated diagram images should be written.
 * Uses `imagesoutdir` when set; otherwise combines the output directory with `imagesdir`.
 *
 * @param {Object} doc - Asciidoctor document.
 * @returns {string} Absolute or relative path to the images output directory.
 */
const getImagesOutputDirectory = (doc) => {
  const imagesOutputDir = doc.getAttribute('imagesoutdir')
  if (imagesOutputDir) {
    return imagesOutputDir
  }
  const outputDirectory = getOutputDirectory(doc)
  const imagesDir = doc.getAttribute('imagesdir') || ''
  return path.join(outputDirectory, imagesDir)
}

/**
 * Resolves the document output directory.
 * For nested documents the parent document's `to_dir` option is used, as nested
 * documents do not expose their own until a future Asciidoctor release.
 *
 * @param {Object} doc - Asciidoctor document.
 * @returns {string} Output directory path, falling back to the document base directory.
 */
const getOutputDirectory = (doc) => {
  // the nested document logic will become obsolete once https://github.com/asciidoctor/asciidoctor/commit/7edc9da023522be67b17e2a085d72e056703a438 is released
  const outDir =
    doc.getAttribute('outdir') ||
    (doc.isNested() ? doc.getParentDocument() : doc).getOptions().to_dir
  const baseDir = doc.getBaseDir()
  if (outDir) {
    return outDir
  }
  return baseDir
}

/**
 * Resolves the media type and encoding to use for a given diagram output format.
 *
 * @param {string} format - Diagram output format (e.g. `svg`, `png`, `txt`).
 * @returns {{mediaType: string, encoding: BufferEncoding}}
 */
const mediaTypeAndEncoding = (format) => {
  if (format === 'txt' || format === 'atxt' || format === 'utxt') {
    return { mediaType: 'text/plain; charset=utf-8', encoding: 'utf8' }
  }
  if (format === 'svg') {
    return { mediaType: 'image/svg+xml', encoding: 'binary' }
  }
  return { mediaType: 'image/png', encoding: 'binary' }
}

/**
 * Fetches a rendered diagram from Kroki and returns it as a `data:` URI,
 * embedding the content directly without writing any file. Shared by data-URI
 * mode and by the `inline` option, which both need the content carried in the
 * node (as a standard data-URI image target) rather than referenced by URL or
 * file path — keeping the extension converter-agnostic.
 *
 * @param {import('./kroki-client.js').KrokiDiagram} krokiDiagram - Diagram to render.
 * @param {import('./kroki-client.js').KrokiClient} krokiClient - Client used to fetch the diagram.
 * @returns {Promise<string>} A `data:` URI embedding the rendered diagram.
 */
const toDataUri = async (krokiDiagram, krokiClient) => {
  const { mediaType, encoding } = mediaTypeAndEncoding(krokiDiagram.format)
  const contents = await krokiClient.getImage(krokiDiagram, encoding)
  return `data:${mediaType};base64,${Buffer.from(contents, encoding).toString('base64')}`
}

/**
 * Per-document registry of file names generated from an explicit diagram name,
 * mapped to the diagram URI they were generated from. Used to detect when the
 * same name is reused for diagrams with different content within one conversion.
 *
 * @type {WeakMap<Object, Map<string, string>>}
 */
const generatedNamesByDocument = new WeakMap()

export default {
  toDataUri,
  /**
   * Fetches a rendered diagram from Kroki (or from the local cache) and either
   * saves it to the virtual filesystem or returns it as a `data:` URI.
   *
   * When an explicit name is provided, the file name is the name itself (e.g.
   * `foo.svg`) so that links stay stable across content changes. Anonymous
   * diagrams use a content-addressed name (`diag-<sha256>.svg`) so they never
   * collide and can be reused from disk when unchanged.
   *
   * @param {import('./kroki-client.js').KrokiDiagram} krokiDiagram - Diagram to render.
   * @param {Object} doc - Asciidoctor document whose attributes control output paths
   *   and data-URI mode (`data-uri`, `kroki-data-uri`, `imagesoutdir`, `imagesdir`).
   * @param {string|undefined} target - Explicit base name for the output file; when omitted a content-addressed name is used.
   * @param {Object|undefined} vfs - Virtual filesystem implementation; resolved via {@link resolveVfs}.
   * @param {import('./kroki-client.js').KrokiClient} krokiClient - Client used to fetch the diagram when not cached.
   * @returns {Promise<string>} The diagram file name (relative to the images output directory)
   *   or a `data:` URI when data-URI mode is active.
   */
  save: async (krokiDiagram, doc, target, vfs, krokiClient) => {
    const { exists, read, add } = resolveVfs(vfs)

    const imagesOutputDirectory = getImagesOutputDirectory(doc)
    const dataUri =
      doc.isAttribute('data-uri') || doc.isAttribute('kroki-data-uri')
    const diagramUrl = krokiDiagram.getDiagramUri(krokiClient.getServerUrl())
    const format = krokiDiagram.format
    const { mediaType, encoding } = mediaTypeAndEncoding(format)

    // In data-URI mode no file is written, so the file name is irrelevant: embed the diagram inline.
    if (dataUri) {
      return toDataUri(krokiDiagram, krokiClient)
    }

    // An explicit name is used verbatim so links stay stable; otherwise the name is
    // content-addressed so anonymous diagrams don't collide (see #451).
    const named = typeof target === 'string' && target !== ''
    const diagramName = named
      ? `${target}.${format}`
      : `diag-${createHash('sha256').update(diagramUrl).digest('hex')}.${format}`
    const filePath = path.format({
      dir: imagesOutputDirectory,
      base: diagramName,
    })

    let contents
    if (named) {
      // A stable file may exist from a previous build with stale content, so it cannot
      // be trusted: re-fetch and overwrite. Reuse the file only when the very same
      // diagram was already generated in this conversion, and warn on a name clash.
      let generated = generatedNamesByDocument.get(doc)
      if (!generated) {
        generated = new Map()
        generatedNamesByDocument.set(doc, generated)
      }
      const previousUrl = generated.get(diagramName)
      if (previousUrl === diagramUrl && exists(filePath)) {
        contents = await read(filePath, encoding)
      } else {
        if (previousUrl !== undefined && previousUrl !== diagramUrl) {
          doc
            .getLogger()
            .warn(
              `kroki: the diagram file name '${diagramName}' is generated by more than one diagram with different content; the file will be overwritten. Use unique names to keep stable links.`,
            )
        }
        contents = await krokiClient.getImage(krokiDiagram, encoding)
      }
      generated.set(diagramName, diagramUrl)
    } else {
      // Content-addressed name: an existing file necessarily has identical content.
      contents = exists(filePath)
        ? await read(filePath, encoding)
        : await krokiClient.getImage(krokiDiagram, encoding)
    }

    add({
      relative: imagesOutputDirectory,
      basename: diagramName,
      mediaType,
      contents: Buffer.from(contents, encoding),
    })
    return diagramName
  },
}
