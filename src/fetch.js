import { createHash } from 'node:crypto'
import { posix as path } from 'node:path'
import fs from './node-fs.js'

const getImagesOutputDirectory = (doc) => {
  const imagesOutputDir = doc.getAttribute('imagesoutdir')
  if (imagesOutputDir) {
    return imagesOutputDir
  }
  const outputDirectory = getOutputDirectory(doc)
  const imagesDir = doc.getAttribute('imagesdir') || ''
  return path.join(outputDirectory, imagesDir)
}

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
  save: (krokiDiagram, doc, target, vfs, krokiClient) => {
    const exists =
      typeof vfs !== 'undefined' && typeof vfs.exists === 'function'
        ? vfs.exists
        : fs.exists
    const read =
      typeof vfs !== 'undefined' && typeof vfs.read === 'function'
        ? vfs.read
        : fs.read
    const add =
      typeof vfs !== 'undefined' && typeof vfs.add === 'function'
        ? vfs.add
        : fs.add

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
    let contents
    if (exists(filePath)) {
      contents = read(filePath, encoding)
    } else {
      contents = krokiClient.getImage(krokiDiagram, encoding)
    }
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
