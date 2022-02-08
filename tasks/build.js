import { rollup } from 'rollup'
import alias from '@rollup/plugin-alias'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const packageJson = require('../package.json')

function banner () {
  return {
    name: 'rollup-plugin-banner',
    renderChunk (code, chunk, options) {
      return `/* @license Asciidoctor Kroki ${packageJson.version} | MIT | https://github.com/mogztter/asciidoctor-kroki */\n${code}`
    }
  }
}

;(async () => {
  try {
    // ECMAScript module (Node)
    const nodeBundle = await rollup({
      input: 'src/index.js',
      external: [
        'pako',
        'path',
        'json5',
        'fs',
        'mkdirp',
        'url',
        'unxhr',
        'rusha',
        'crypto',
        'buffer'
      ]
    })
    await nodeBundle.write({
      file: 'dist/asciidoctor-kroki.js',
      format: 'esm'
    })
    console.log('Wrote dist/asciidoctor-kroki.js - ECMAScript module (Node)')

    // CommonJS module (Node)
    await nodeBundle.write({
      file: 'dist/asciidoctor-kroki.cjs',
      format: 'cjs'
    })
    console.log('Wrote dist/asciidoctor-kroki.js - CommonJS module (Node)')

    // UMD module (legacy browser)
    const browserBundle = await rollup({
      input: 'src/index.js',
      context: 'globalThis',
      plugins: [
        alias({
          entries: {
            unxhr: require.resolve(join(__dirname, '..', 'src', 'shim', 'unxhr')),
            './preprocess.js': require.resolve(join(__dirname, '..', 'src', 'shim', 'preprocess')),
            './fs.js': require.resolve(join(__dirname, '..', 'src', 'shim', 'fs')),
            path: require.resolve(join(__dirname, '..', 'src', 'shim', 'path')),
            crypto: require.resolve(join(__dirname, '..', 'src', 'shim', 'crypto'))
          }
        }),
        nodeResolve({ preferBuiltins: false }),
        commonjs(),
        terser(),
        banner()
      ]
    })
    await browserBundle.write({
      file: 'dist/asciidoctor-kroki.umd.js',
      format: 'umd',
      name: 'AsciidoctorKroki'
    })
    console.log('Wrote dist/asciidoctor-kroki.umd.js - UMD module (legacy browser)')

    // ECMAScript module (modern browser)
    await browserBundle.write({
      file: 'dist/asciidoctor-kroki.module.js',
      format: 'esm'
    })
    console.log('Wrote dist/asciidoctor-kroki.module.js - ECMAScript module (modern browser)')
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
})()
