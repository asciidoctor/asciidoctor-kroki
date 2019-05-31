const rusha = require('rusha')
const path = require('path')

module.exports.save = function (diagramUrl, doc, target, format, vfs) {
  const imagesOutputDir = doc.getAttribute('imagesoutdir')
  const outDir = doc.getAttribute('outdir')
  const toDir = doc.getAttribute('to_dir')
  const baseDir = doc.getAttribute('base_dir') || ''
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
  const diagramName = `${rusha.createHash().update(diagramUrl).digest('hex')}.${format}`
  let exists
  if (typeof vfs === 'undefined' || typeof vfs.exists !== 'function') {
    exists = require('./node-fs').exists
  } else {
    exists = vfs.exists
  }
  let read
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    read = require('./node-fs').read
  } else {
    read = vfs.read
  }
  const filePath = path.format({ dir: dirPath, base: diagramName })
  let contents
  if (exists(filePath)) {
    // file already exists on the file system
    contents = read(filePath, 'binary')
  } else {
    contents = read(diagramUrl, 'binary')
  }
  let add
  if (typeof vfs === 'undefined' || typeof vfs.add !== 'function') {
    add = require('./node-fs').add
  } else {
    add = vfs.add
  }
  add({
    relative: dirPath,
    basename: diagramName,
    mediaType: format === 'svg' ? 'image/svg+xml' : 'image/png',
    contents: Buffer.from(contents, 'binary')
  })
  return diagramName
}
