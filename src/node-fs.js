import fs from 'node:fs'
import path from 'node:path'
import mkdirp from 'mkdirp'
import url from 'node:url'

import http from './http/node-http.js'

export default {
  add: (image) => {
    mkdirp.sync(image.relative)
    const filePath = path.format({ dir: image.relative, base: image.basename })
    fs.writeFileSync(filePath, image.contents, 'binary')
  },
  exists: (path) => {
    return fs.existsSync(path)
  },
  read: (path, encoding = 'utf8') => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return http.get(path, encoding)
    }
    if (path.startsWith('file://')) {
      return fs.readFileSync(url.fileURLToPath(path), encoding)
    }
    return fs.readFileSync(path, encoding)
  },
  parse: (resourceId) => {
    return {
      dir: path.dirname(resourceId),
      path: resourceId,
    }
  },
}
