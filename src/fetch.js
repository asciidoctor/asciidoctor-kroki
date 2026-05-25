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

export default {
  /**
   * Fetches a rendered diagram from Kroki (or from the local cache) and either
   * saves it to the virtual filesystem or returns it as a `data:` URI.
   *
   * The output file name is derived from the target name and a SHA-1 hash of the
   * diagram URI, so identical diagrams are written only once.
   *
   * @param {import('./kroki-client.js').KrokiDiagram} krokiDiagram - Diagram to render.
   * @param {Object} doc - Asciidoctor document whose attributes control output paths
   *   and data-URI mode (`data-uri`, `kroki-data-uri`, `imagesoutdir`, `imagesdir`).
   * @param {string|undefined} target - Desired base name for the output file; defaults to `'diag'`.
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
    const diagramName = `${target || 'diag'}-${createHash('sha1').update(diagramUrl).digest('hex')}.${format}`
    const filePath = path.format({
      dir: imagesOutputDirectory,
      base: diagramName,
    })
    /** @type {BufferEncoding} */
    let encoding
    let mediaType
    if (format === 'txt' || format === 'atxt' || format === 'utxt') {
      mediaType = 'text/plain; charset=utf-8'
      encoding = 'utf8'
    } else if (format === 'svg') {
      mediaType = 'image/svg+xml'
      encoding = 'binary'
    } else {
      mediaType = 'image/png'
      encoding = 'binary'
    }
    // file is either (already) on the file system or we should read it from Kroki
    const contents = exists(filePath)
      ? await read(filePath, encoding)
      : await krokiClient.getImage(krokiDiagram, encoding)
    if (dataUri) {
      return (
        'data:' +
        mediaType +
        ';base64,' +
        Buffer.from(contents, encoding).toString('base64')
      )
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
