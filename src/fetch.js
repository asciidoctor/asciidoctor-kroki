const rusha = require('rusha')
const path = require('path')
const os = require('os')
const fs = require('fs')

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
  const outDir = doc.getAttribute('outdir') || (doc.isNested() ? doc.getParentDocument() : doc).getOptions().to_dir
  const baseDir = doc.getBaseDir()
  if (outDir) {
    return outDir
  }
  return baseDir
}

module.exports.save = function (krokiDiagram, doc, target, vfs, krokiClient) {
  const exists = typeof vfs !== 'undefined' && typeof vfs.exists === 'function' ? vfs.exists : require('./node-fs.js').exists
  const read = typeof vfs !== 'undefined' && typeof vfs.read === 'function' ? vfs.read : require('./node-fs.js').read
  const add = typeof vfs !== 'undefined' && typeof vfs.add === 'function' ? vfs.add : require('./node-fs.js').add

  const imagesOutputDirectory = getImagesOutputDirectory(doc)
  const diagramUrl = krokiDiagram.getDiagramUri(krokiClient.getServerUrl())
  const format = krokiDiagram.format
  const diagramName = `${target || 'diag'}-${rusha.createHash().update(diagramUrl).digest('hex')}.${format}`
  const filePath = path.format({ dir: imagesOutputDirectory, base: diagramName })
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
  const cacheBaseDir = process.env.KROKI_CACHE_DIR ? process.env.KROKI_CACHE_DIR : os.tmpdir()
  const cacheFilePath = `${fs.realpathSync(cacheBaseDir)}/${diagramName}`
  // file is either (already) on the file system, in the cache, or we should read it from Kroki
  let contents
  if (exists(filePath)) {
    contents = read(filePath, encoding)
  } else {
    if (fs.existsSync(cacheFilePath)) {
      contents = fs.readFileSync(cacheFilePath, encoding)
    } else {
      contents = krokiClient.getImage(krokiDiagram, encoding)
      fs.writeFileSync(cacheFilePath, contents, encoding)
    }
  }
  add({
    relative: imagesOutputDirectory,
    basename: diagramName,
    mediaType,
    contents: Buffer.from(contents, encoding)
  })
  return diagramName
}
