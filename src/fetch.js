const rusha = require('rusha')
const path = require('path')

const getDirPath = (doc) => {
  const imagesOutputDir = doc.getAttribute('imagesoutdir')
  const outDir = doc.getAttribute('outdir')
  const toDir = doc.getAttribute('to_dir')
  const baseDir = doc.getBaseDir()
  const imagesDir = doc.getAttribute('imagesdir') || ''
  let dirPath
  if (imagesOutputDir) {
    dirPath = imagesOutputDir
  } else if (outDir) {
    dirPath = path.join(outDir, imagesDir)
  } else if (toDir) {
    dirPath = path.join(toDir, imagesDir)
  } else {
    dirPath = path.join(baseDir, imagesDir)
  }
  return dirPath
}

module.exports.save = function (krokiDiagram, doc, target, vfs, krokiClient) {
  const exists = typeof vfs !== 'undefined' && typeof vfs.exists === 'function' ? vfs.exists : require('./node-fs.js').exists
  const read = typeof vfs !== 'undefined' && typeof vfs.read === 'function' ? vfs.read : require('./node-fs.js').read
  const add = typeof vfs !== 'undefined' && typeof vfs.add === 'function' ? vfs.add : require('./node-fs.js').add

  const dirPath = getDirPath(doc)
  const diagramUrl = krokiDiagram.getDiagramUri(krokiClient.getServerUrl())
  const format = krokiDiagram.format
  const diagramName = `diag-${rusha.createHash().update(diagramUrl).digest('hex')}.${format}`
  const filePath = path.format({ dir: dirPath, base: diagramName })
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
  const contents = exists(filePath) ? read(filePath, encoding) : krokiClient.getImage(krokiDiagram, encoding)
  add({
    relative: dirPath,
    basename: diagramName,
    mediaType: mediaType,
    contents: Buffer.from(contents, encoding)
  })
  return diagramName
}
