import { defineConfig } from 'rollup'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const shim = (name) => join(__dirname, `test/shims/${name}.js`)

// `save()` writes to a filesystem, which genuinely has no browser equivalent, so it
// keeps throwing. `toDataUri()` only needs `fetch` and `btoa` (both browser globals),
// so it's reimplemented here rather than stubbed out -- self-contained, since relative
// imports from this virtual module do not resolve against a real file location.
const FETCH_STUB = `
const mediaTypeAndEncoding = (format) => {
  if (format === 'txt' || format === 'atxt' || format === 'utxt') {
    return { mediaType: 'text/plain; charset=utf-8', encoding: 'utf8' }
  }
  if (format === 'svg') {
    return { mediaType: 'image/svg+xml', encoding: 'binary' }
  }
  return { mediaType: 'image/png', encoding: 'binary' }
}
const toBase64 = (bytes) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
const toDataUri = async (krokiDiagram, krokiClient) => {
  const { mediaType, encoding } = mediaTypeAndEncoding(krokiDiagram.format)
  const contents = await krokiClient.getImage(krokiDiagram, encoding)
  const bytes = encoding === 'utf8'
    ? new TextEncoder().encode(contents)
    : Uint8Array.from(contents, (char) => char.charCodeAt(0))
  return \`data:\${mediaType};base64,\${toBase64(bytes)}\`
}
export default {
  toDataUri,
  save: () => { throw new Error('kroki-fetch-diagram is not supported in the browser') },
}
`

// Stub code indexed by resolved absolute path suffix
const PATH_STUBS = new Map([
  ['/src/node-fs.js', 'export default {}; export function resolveVfs(vfs) { return vfs || {} }'],
  ['/src/fetch.js', FETCH_STUB],
  ['/src/antora-adapter.js', 'export default function () {}'],
])

// Stub code indexed by bare module specifier
const ID_STUBS = new Map([
  ['node:crypto', 'export const createHash = () => ({ update: () => ({ digest: () => "" }) }); export default {}'],
  ['node:fs', 'export default {}'],
  ['node:os', 'export default {}'],
  ['node:url', 'export const fileURLToPath = (u) => u; export const pathToFileURL = (p) => p; export default {}'],
])

function browserStubs() {
  return {
    name: 'browser-stubs',

    async resolveId(source, importer) {
      if (source === 'node:path') {
        return shim('node-path')
      }
      if (ID_STUBS.has(source)) {
        return `\0stub:${source}`
      }
      if (importer && (source.startsWith('./') || source.startsWith('../'))) {
        const resolved = await this.resolve(source, importer, { skipSelf: true })
        if (resolved) {
          for (const [suffix] of PATH_STUBS) {
            if (resolved.id.endsWith(suffix)) {
              return `\0stub:${suffix}`
            }
          }
        }
      }
    },

    load(id) {
      if (id.startsWith('\0stub:')) {
        const key = id.slice(6)
        return ID_STUBS.get(key) ?? PATH_STUBS.get(key) ?? 'export default {}'
      }
    },
  }
}

const target = process.env.BUILD_TARGET

const browserConfig = {
  input: 'src/asciidoctor-kroki.js',
  output: {
    file: 'build/browser/index.js',
    format: 'esm',
  },
  plugins: [
    browserStubs(),
    json(),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
  ],
}

const nodeConfig = {
  input: 'src/asciidoctor-kroki.js',
  output: {
    file: 'build/node/index.cjs',
    format: 'cjs',
    exports: 'auto',
  },
  external: [
    /^node:/,
    'json5',
    'pako',
  ],
  plugins: [
    json(),
    resolve(),
    commonjs(),
  ],
}

const configs = { browser: browserConfig, node: nodeConfig }

export default defineConfig(target ? configs[target] : [browserConfig, nodeConfig])