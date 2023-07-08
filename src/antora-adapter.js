const ospath = require('path').posix

module.exports = (file, contentCatalog, vfs) => {
  let baseReadFn
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    baseReadFn = require('./node-fs').read
  } else {
    baseReadFn = vfs.read
  }
  let baseParseFn
  if (typeof vfs === 'undefined' || typeof vfs.parse !== 'function') {
    baseParseFn = require('./node-fs').parse
  } else {
    baseParseFn = vfs.parse
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
    read: (resourceId, format, hash) => {
      const ctx = hash || file.src
      const target = contentCatalog.resolveResource(resourceId, ctx, ctx.family)
      return target ? target.contents.toString() : baseReadFn(resourceId, format)
    },
    exists: (resourceId) => {
      const target = contentCatalog.resolveResource(resourceId, file.src)
      return target ? true : baseExistsFn(resourceId)
    },
    parse: (resourceId, hash) => {
      const ctx = hash || file.src
      const target = contentCatalog.resolveResource(resourceId, ctx, ctx.family)
      return target ? target.src : baseParseFn(resourceId)
    }
  }
}
