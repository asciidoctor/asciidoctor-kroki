import { defineConfig } from 'rollup'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const shim = (name) => join(__dirname, `test/shims/${name}.js`)

// Stub code indexed by resolved absolute path suffix
const PATH_STUBS = new Map([
  ['/src/node-fs.js', 'export default {}; export function resolveVfs(vfs) { return vfs || {} }'],
  ['/src/fetch.js', "export default { save: () => { throw new Error('kroki-fetch-diagram is not supported in the browser') } }"],
  ['/src/antora-adapter.js', 'export default function () {}'],
  ['/src/http/node-http.js', 'export default { get: () => {}, post: () => {} }'],
])

// Stub code indexed by bare module specifier
const ID_STUBS = new Map([
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

export default defineConfig([
  // Browser ESM — single self-contained bundle, Node-specific modules stubbed out
  {
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
  },

  // Node CJS — runtime deps kept external (they live in node_modules)
  {
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
  },
])