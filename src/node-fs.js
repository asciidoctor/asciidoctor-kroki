const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const url = require('url')

const http = require('./http/node-http.js')

module.exports = {
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
      path: resourceId
    }
  }
}
