import { toBase64 } from './base64.js'

const mediaTypeAndEncoding = (format) => {
  if (format === 'txt' || format === 'atxt' || format === 'utxt') {
    return { mediaType: 'text/plain; charset=utf-8', encoding: 'utf8' }
  }
  if (format === 'svg') {
    return { mediaType: 'image/svg+xml', encoding: 'binary' }
  }
  return { mediaType: 'image/png', encoding: 'binary' }
}

const toDataUri = async (krokiDiagram, krokiClient) => {
  const { mediaType, encoding } = mediaTypeAndEncoding(krokiDiagram.format)
  const contents = await krokiClient.getImage(krokiDiagram, encoding)
  const bytes =
    encoding === 'utf8'
      ? new TextEncoder().encode(contents)
      : Uint8Array.from(contents, (char) => char.charCodeAt(0))
  return `data:${mediaType};base64,${toBase64(bytes)}`
}

/**
 * Browser build of `fetch.js`: `toDataUri()` only needs `fetch` and `btoa` (both
 * browser globals), so this is a straight reimplementation rather than a stub --
 * swapped in for `src/fetch.js` at build time, see `rollup.config.js`. There is no
 * disk to write to (nor a persistent cache to read from), so `save()` always embeds
 * the diagram as a `data:` URI, whether or not `data-uri` or `kroki-data-uri` is set.
 */
export default {
  toDataUri,
  save: async (krokiDiagram, _doc, _target, _vfs, krokiClient) => ({
    target: await toDataUri(krokiDiagram, krokiClient),
  }),
}
