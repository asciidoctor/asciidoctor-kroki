import { Buffer } from 'buffer'
import { createHash } from 'crypto'
import { format as pathFormat, join } from 'path'
import nodeFs from './fs.js'

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
    dirPath = join(outDir, imagesDir)
  } else if (toDir) {
    dirPath = join(toDir, imagesDir)
  } else {
    dirPath = join(baseDir, imagesDir)
  }
  return dirPath
}

export const save = function (krokiDiagram, doc, target, vfs, krokiClient) {
  const fs = {
    exists: typeof vfs !== 'undefined' && typeof vfs.exists === 'function' ? vfs.exists : nodeFs.exists,
    read: typeof vfs !== 'undefined' && typeof vfs.read === 'function' ? vfs.read : nodeFs.read,
    add: typeof vfs !== 'undefined' && typeof vfs.add === 'function' ? vfs.add : nodeFs.add
  }
  const dirPath = getDirPath(doc)
  const diagramUrl = krokiDiagram.getDiagramUri(krokiClient.getServerUrl())
  const format = krokiDiagram.format
  const diagramName = `diag-${createHash('sha1').update(diagramUrl).digest('hex')}.${format}`
  const filePath = pathFormat({ dir: dirPath, base: diagramName })
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
  const contents = fs.exists(filePath) ? fs.read(filePath, encoding) : krokiClient.getImage(krokiDiagram, encoding)
  fs.add({
    relative: dirPath,
    basename: diagramName,
    mediaType: mediaType,
    contents: Buffer.from(contents, encoding)
  })
  return diagramName
}
