import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import http from './http/node-http.js'

const nodefs = {
  add: (image) => {
    fs.mkdirSync(image.relative, { recursive: true })
    const filePath = path.format({ dir: image.relative, base: image.basename })
    fs.writeFileSync(filePath, image.contents, 'binary')
  },
  exists: (path) => {
    return fs.existsSync(path)
  },
  read: async (path, encoding = 'utf8') => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return http.get(path, {}, encoding)
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

export function resolveVfs(vfs) {
  return {
    read: typeof vfs?.read === 'function' ? vfs.read : nodefs.read,
    exists: typeof vfs?.exists === 'function' ? vfs.exists : nodefs.exists,
    parse: typeof vfs?.parse === 'function' ? vfs.parse : nodefs.parse,
    add: typeof vfs?.add === 'function' ? vfs.add : nodefs.add,
  }
}

export default nodefs
