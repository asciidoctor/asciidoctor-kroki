const ospath = require('path')

module.exports = (file, contentCatalog, vfs) => {
  let baseReadFn
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    baseReadFn = require('./node-fs').read
  } else {
    baseReadFn = vfs.read
  }
  let baseDirnameFn
  if (typeof vfs === 'undefined' || typeof vfs.dirname !== 'function') {
    baseDirnameFn = require('./node-fs').dirname
  } else {
    baseDirnameFn = vfs.dirname
  }
  let baseExistsFn
  if (typeof vfs === 'undefined' || typeof vfs.exists !== 'function') {
    baseExistsFn = require('./node-fs').exists
  } else {
    baseExistsFn = vfs.exists
  }
  return {
    add: (image) => {
      const { component, version, module } = file.src
      if (!contentCatalog.getById({ component, version, module, family: 'image', relative: image.basename })) {
        contentCatalog.addFile({
          contents: image.contents,
          src: {
            component,
            version,
            module,
            family: 'image',
            mediaType: image.mediaType,
            path: ospath.join(image.relative, image.basename),
            basename: image.basename,
            relative: image.basename
          }
        })
      }
    },
    read: (resourceId, format) => {
      const target = contentCatalog.resolveResource(resourceId, file.src)
      return target ? target.contents.toString() : baseReadFn(resourceId, format)
    },
    exists: (resourceId) => {
      const target = contentCatalog.resolveResource(resourceId, file.src)
      return target ? true : baseExistsFn(resourceId)
    },
    dirname: (resourceId) => {
      const target = contentCatalog.resolveResource(resourceId, file.src)
      return target ? ospath.dirname(target.src.abspath || target.src.path) : baseDirnameFn(resourceId)
    }
  }
}
