import fs from 'fs'
import { format } from 'path'
import mkdirp from 'mkdirp'
import url from 'url'

import { get } from './http.js'

export default {
  add: (image) => {
    mkdirp.sync(image.relative)
    const filePath = format({ dir: image.relative, base: image.basename })
    fs.writeFileSync(filePath, image.contents, 'binary')
  },
  exists: (path) => {
    return fs.existsSync(path)
  },
  read: (path, encoding = 'utf8') => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return get(path, encoding)
    }
    if (path.startsWith('file://')) {
      return fs.readFileSync(url.fileURLToPath(path), encoding)
    }
    return fs.readFileSync(path, encoding)
  }
}
