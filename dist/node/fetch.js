const rusha = require('rusha')
const path = require('path')

module.exports.save = function (diagramUrl, doc, target, format, vfs) {
  const dirPath = path.join(doc.getAttribute('imagesoutdir') || '', doc.getAttribute('imagesdir') || '')
  const diagramName = `${target || rusha.createHash().update(diagramUrl).digest('hex')}.${format}`
  let read
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    read = require('./node-fs').read
  } else {
    read = vfs.read
  }
  const contents = read(diagramUrl, 'binary')
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
