import { posix as ospath } from 'node:path'
import { resolveVfs } from './node-fs.js'

export default function (file, contentCatalog, vfs) {
  const {
    read: baseReadFn,
    parse: baseParseFn,
    exists: baseExistsFn,
  } = resolveVfs(vfs)
  return {
    add: (image) => {
      const { component, version, module } = file.src
      if (
        !contentCatalog.getById({
          component,
          version,
          module,
          family: 'image',
          relative: image.basename,
        })
      ) {
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
            relative: image.basename,
          },
        })
      }
    },
    read: (resourceId, format, hash) => {
      const ctx = hash || file.src
      const target = contentCatalog.resolveResource(resourceId, ctx, ctx.family)
      return target
        ? target.contents.toString()
        : baseReadFn(resourceId, format)
    },
    exists: (resourceId) => {
      const target = contentCatalog.resolveResource(resourceId, file.src)
      return target ? true : baseExistsFn(resourceId)
    },
    parse: (resourceId, hash) => {
      const ctx = hash || file.src
      const target = contentCatalog.resolveResource(resourceId, ctx, ctx.family)
      return target ? target.src : baseParseFn(resourceId)
    },
  }
}
