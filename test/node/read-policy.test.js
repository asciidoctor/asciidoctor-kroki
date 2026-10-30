import assert from 'node:assert'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { inflateSync } from 'node:zlib'
import {
  convert,
  Extensions,
  LoggerManager,
  MemoryLogger,
} from '@asciidoctor/core'
import { register } from '../../src/index.js'

// Decodes the diagram source from a Kroki URL found in the converted HTML.
const diagramSource = (html) => {
  const match =
    /src="[^"]*\/(?:plantuml|vegalite|structurizr)\/\w+\/([\w=-]+)"/.exec(html)
  assert.ok(match, `No Kroki URL found in:\n${html}`)
  return inflateSync(Buffer.from(match[1], 'base64url')).toString()
}

describe('Read and write policy', () => {
  let baseDir
  let outsideDir
  let secretFile
  let server
  let serverUrl
  let requests

  const run = async (
    input,
    { safe = 'safe', attributes = {}, context = {} } = {},
  ) => {
    const logger = MemoryLogger.create()
    const previous = LoggerManager.getLogger()
    LoggerManager.setLogger(logger)
    try {
      const registry = Extensions.create()
      register(registry, context)
      const html = await convert(input, {
        extension_registry: registry,
        standalone: false,
        safe,
        base_dir: baseDir,
        attributes,
      })
      return { html, logs: logger.getMessages().map((m) => m.getText()) }
    } finally {
      LoggerManager.setLogger(previous)
    }
  }

  before(async () => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kroki-base-'))
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kroki-outside-'))
    secretFile = path.join(outsideDir, 'secret.txt')
    fs.writeFileSync(secretFile, 'TOP-SECRET')
    fs.writeFileSync(path.join(baseDir, 'inside.puml'), 'skinparam inside true')
    fs.mkdirSync(path.join(baseDir, 'sub'))
    requests = []
    server = http.createServer((req, res) => {
      requests.push(req.url)
      res.end('REMOTE-CONTENT')
    })
    await new Promise((resolve) => server.listen(0, resolve))
    serverUrl = `http://localhost:${server.address().port}`
  })

  after(() => {
    server.close()
    fs.rmSync(baseDir, { recursive: true, force: true })
    fs.rmSync(outsideDir, { recursive: true, force: true })
  })

  const block = (type, body) => `[${type}]\n....\n${body}\n....\n`

  describe('local files', () => {
    for (const safe of ['safe', 'server']) {
      test(`does not read a PlantUML !include outside of the base directory in ${safe} mode`, async () => {
        const { html, logs } = await run(
          block('plantuml', `!include ${secretFile}\nalice`),
          { safe },
        )
        assert.ok(!diagramSource(html).includes('TOP-SECRET'))
        assert.ok(diagramSource(html).includes(`!include ${secretFile}`))
        assert.ok(
          logs.some((log) => log.includes('outside of the base directory')),
          logs.join('\n'),
        )
      })
      test(`does not read kroki-plantuml-include outside of the base directory in ${safe} mode`, async () => {
        const { html, logs } = await run(block('plantuml', 'alice'), {
          safe,
          attributes: { 'kroki-plantuml-include': secretFile },
        })
        assert.strictEqual(diagramSource(html), 'alice')
        assert.ok(
          logs.some((log) => log.includes('Unable to read plantuml-include')),
          logs.join('\n'),
        )
      })
      test(`does not read a Structurizr !include outside of the base directory in ${safe} mode`, async () => {
        const { html } = await run(
          block('structurizr', `workspace {\n!include ${secretFile}\n}`),
          { safe },
        )
        assert.ok(!diagramSource(html).includes('TOP-SECRET'))
      })
      test(`does not read a Vega-Lite data.url outside of the base directory in ${safe} mode`, async () => {
        const { html } = await run(
          block('vegalite', JSON.stringify({ data: { url: secretFile } })),
          { safe },
        )
        assert.ok(
          !html.includes('imageblock') ||
            !diagramSource(html).includes('TOP-SECRET'),
        )
        assert.ok(html.includes('kroki-error'), html)
      })
      test(`does not read a file:// URI outside of the base directory in ${safe} mode`, async () => {
        const { html } = await run(
          block(
            'vegalite',
            JSON.stringify({ data: { url: `file://${secretFile}` } }),
          ),
          { safe },
        )
        assert.ok(html.includes('kroki-error'), html)
      })
    }
    test('reads a !include inside of the base directory in safe mode', async () => {
      const { html } = await run(
        block(
          'plantuml',
          `!include ${path.join(baseDir, 'inside.puml')}\nalice`,
        ),
      )
      assert.ok(diagramSource(html).includes('skinparam inside true'))
    })
    test('reads a !include outside of the base directory in unsafe mode', async () => {
      const { html } = await run(
        block('plantuml', `!include ${secretFile}\nalice`),
        { safe: 'unsafe' },
      )
      assert.ok(diagramSource(html).includes('TOP-SECRET'))
    })
    test('reads kroki-plantuml-include outside of the base directory in unsafe mode', async () => {
      const { html } = await run(block('plantuml', 'alice'), {
        safe: 'unsafe',
        attributes: { 'kroki-plantuml-include': secretFile },
      })
      assert.ok(diagramSource(html).includes('TOP-SECRET'))
    })
    test('leaves the access control to a custom virtual file system', async () => {
      const { html } = await run(
        block('plantuml', '!include /any/file.puml\nalice'),
        {
          context: {
            vfs: { read: async () => 'FROM-VFS', exists: async () => true },
          },
        },
      )
      assert.ok(diagramSource(html).includes('FROM-VFS'))
    })
  })

  describe('relative paths', () => {
    test('resolves a !include of a block from the base directory, not from the current directory', async () => {
      const { html } = await run(
        block('plantuml', '!include inside.puml\nalice'),
      )
      assert.ok(diagramSource(html).includes('skinparam inside true'))
    })
    test('resolves kroki-plantuml-include from the base directory, not from the current directory', async () => {
      const { html } = await run(block('plantuml', 'alice'), {
        attributes: { 'kroki-plantuml-include': 'inside.puml' },
      })
      assert.ok(diagramSource(html).includes('skinparam inside true'))
    })
    test('resolves kroki-plantuml-include from the base directory for a block macro in a subdirectory', async () => {
      fs.writeFileSync(path.join(baseDir, 'sub', 'macro.puml'), 'alice')
      const { html } = await run('plantuml::sub/macro.puml[]\n', {
        attributes: { 'kroki-plantuml-include': 'inside.puml' },
      })
      assert.ok(diagramSource(html).includes('skinparam inside true'))
    })
  })

  describe('remote resources', () => {
    test('does not read a PlantUML !include URL without allow-uri-read', async () => {
      requests.length = 0
      const { html, logs } = await run(
        block('plantuml', `!include ${serverUrl}/a.puml\nalice`),
      )
      assert.strictEqual(requests.length, 0)
      assert.ok(diagramSource(html).includes(`!include ${serverUrl}/a.puml`))
      assert.ok(
        logs.some((log) => log.includes('allow-uri-read')),
        logs.join('\n'),
      )
    })
    test('reads a PlantUML !include URL with allow-uri-read', async () => {
      const { html } = await run(
        block('plantuml', `!include ${serverUrl}/a.puml\nalice`),
        {
          attributes: { 'allow-uri-read': '' },
        },
      )
      assert.ok(diagramSource(html).includes('REMOTE-CONTENT'))
    })
    test('does not read a Structurizr !include URL without allow-uri-read', async () => {
      requests.length = 0
      await run(
        block('structurizr', `workspace {\n!include ${serverUrl}/a.dsl\n}`),
      )
      assert.strictEqual(requests.length, 0)
    })
    test('does not read a Vega-Lite data.url without allow-uri-read', async () => {
      requests.length = 0
      const spec = JSON.stringify({ data: { url: `${serverUrl}/a.csv` } })
      const { html } = await run(block('vegalite', spec))
      assert.strictEqual(requests.length, 0)
      assert.strictEqual(diagramSource(html), spec)
    })
  })

  describe('block macro in secure mode', () => {
    test('does not read a URL target, even with allow-uri-read', async () => {
      requests.length = 0
      const { html } = await run(`plantuml::${serverUrl}/a.puml[]\n`, {
        safe: 'secure',
        attributes: { 'allow-uri-read': '' },
      })
      assert.strictEqual(requests.length, 0)
      assert.ok(html.includes(`<a href="${serverUrl}/a.puml"`), html)
    })
  })

  describe('kroki-plantuml-include', () => {
    test('warns and ignores a missing file', async () => {
      const { html, logs } = await run(block('plantuml', 'alice'), {
        attributes: { 'kroki-plantuml-include': 'missing.puml' },
      })
      assert.strictEqual(diagramSource(html), 'alice')
      assert.ok(
        logs.some((log) => log.includes('Unable to read plantuml-include')),
        logs.join('\n'),
      )
    })
    test('warns and ignores a directory', async () => {
      const { html, logs } = await run(block('plantuml', 'alice'), {
        attributes: { 'kroki-plantuml-include': path.join(baseDir, 'sub') },
      })
      assert.strictEqual(diagramSource(html), 'alice')
      assert.ok(
        logs.some((log) => log.includes('Unable to read plantuml-include')),
        logs.join('\n'),
      )
    })
    test('keeps a standard library include for the Kroki server', async () => {
      const { html } = await run(block('plantuml', 'alice'), {
        attributes: { 'kroki-plantuml-include': '<std/lib>' },
      })
      assert.ok(diagramSource(html).includes('!include <std/lib>'))
    })
  })

  describe('kroki-fetch-diagram output file', () => {
    const fetchAttributes = () => ({
      'kroki-fetch-diagram': '',
      'kroki-cache': 'false',
      'kroki-server-url': serverUrl,
      imagesoutdir: path.join(baseDir, 'images'),
    })
    // Kroki answers with the expected content type, so that the diagram is written.
    let imageServer
    let imageServerUrl
    before(async () => {
      imageServer = http.createServer((_req, res) => {
        res.setHeader('content-type', 'image/svg+xml')
        res.end('<svg/>')
      })
      await new Promise((resolve) => imageServer.listen(0, resolve))
      imageServerUrl = `http://localhost:${imageServer.address().port}`
    })
    after(() => imageServer.close())

    for (const safe of ['safe', 'server']) {
      test(`does not write outside of the output directory in ${safe} mode`, async () => {
        const name = `../../${path.basename(baseDir)}-escaped`
        const { html, logs } = await run(
          `[plantuml,${name}]\n....\nalice\n....\n`,
          {
            safe,
            attributes: {
              ...fetchAttributes(),
              'kroki-server-url': imageServerUrl,
            },
          },
        )
        assert.ok(
          !fs.existsSync(
            path.join(baseDir, '..', `${path.basename(baseDir)}-escaped.svg`),
          ),
        )
        assert.ok(html.includes('imageblock'), html)
        assert.match(html, /src="[^"]*diag-[0-9a-f]+\.svg"/)
        assert.ok(
          logs.some((log) => log.includes('outside of the output directory')),
          logs.join('\n'),
        )
      })
    }
    for (const safe of ['safe', 'server']) {
      for (const [name, value] of [
        ['imagesoutdir', () => outsideDir],
        ['imagesdir', () => `../${path.basename(outsideDir)}`],
        ['outdir', () => outsideDir],
      ]) {
        test(`embeds the diagram when the ${name} attribute of the document is outside of the base directory in ${safe} mode`, async () => {
          const { html, logs } = await run(
            `:${name}: ${value()}\n\n[plantuml,${name}-${safe}]\n....\nalice\n....\n`,
            {
              safe,
              attributes: {
                'kroki-fetch-diagram': '',
                'kroki-cache': 'false',
                'kroki-server-url': imageServerUrl,
              },
            },
          )
          assert.ok(
            !fs.existsSync(path.join(outsideDir, `${name}-${safe}.svg`)),
          )
          assert.match(html, /src="data:image\/svg\+xml;base64,/)
          assert.ok(
            logs.some((log) => log.includes('embedding the diagram')),
            logs.join('\n'),
          )
        })
      }
    }
    test('writes to a directory of the document inside of the base directory', async () => {
      const { html, logs } = await run(
        ':imagesdir: sub\n\n[plantuml,in-sub]\n....\nalice\n....\n',
        {
          attributes: {
            'kroki-fetch-diagram': '',
            'kroki-cache': 'false',
            'kroki-server-url': imageServerUrl,
          },
        },
      )
      assert.match(html, /in-sub\.svg"/)
      assert.ok(fs.existsSync(path.join(baseDir, 'sub', 'in-sub.svg')))
      assert.deepStrictEqual(logs, [])
    })
    test('writes to a directory outside of the base directory set from the API', async () => {
      const dir = path.join(outsideDir, 'api-images')
      const { html } = await run('[plantuml,api]\n....\nalice\n....\n', {
        attributes: {
          'kroki-fetch-diagram': '',
          'kroki-cache': 'false',
          'kroki-server-url': imageServerUrl,
          imagesoutdir: dir,
        },
      })
      assert.match(html, /api\.svg"/)
      assert.ok(fs.existsSync(path.join(dir, 'api.svg')))
    })
    test('leaves the output directory to a custom add function', async () => {
      const added = []
      const { html } = await run(
        `:imagesoutdir: ${outsideDir}\n\n[plantuml,custom]\n....\nalice\n....\n`,
        {
          attributes: {
            'kroki-fetch-diagram': '',
            'kroki-cache': 'false',
            'kroki-server-url': imageServerUrl,
          },
          context: {
            vfs: {
              add: async (image) => {
                added.push(image.basename)
              },
            },
          },
        },
      )
      assert.match(html, /custom\.svg"/)
      assert.deepStrictEqual(added, ['custom.svg'])
    })
    test('ignores the kroki-cache-dir attribute of the document outside of the base directory', async () => {
      const xdgCacheHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kroki-xdg-'))
      const originalXdgCacheHome = process.env.XDG_CACHE_HOME
      process.env.XDG_CACHE_HOME = xdgCacheHome
      const cacheDir = path.join(outsideDir, 'doc-cache')
      try {
        const { logs } = await run(
          `:kroki-cache-dir: ${cacheDir}\n\n[plantuml,a]\n....\nalice\n....\n\n[plantuml,b]\n....\nbob\n....\n`,
          {
            attributes: {
              'kroki-fetch-diagram': '',
              'kroki-server-url': imageServerUrl,
              imagesoutdir: path.join(baseDir, 'images'),
            },
          },
        )
        assert.ok(!fs.existsSync(cacheDir))
        assert.ok(fs.readdirSync(path.join(xdgCacheHome, 'kroki')).length > 0)
        assert.strictEqual(
          logs.filter((log) => log.includes('kroki-cache-dir')).length,
          1,
          logs.join('\n'),
        )
      } finally {
        if (originalXdgCacheHome === undefined) {
          delete process.env.XDG_CACHE_HOME
        } else {
          process.env.XDG_CACHE_HOME = originalXdgCacheHome
        }
        fs.rmSync(xdgCacheHome, { recursive: true, force: true })
      }
    })
    test('uses a kroki-cache-dir attribute outside of the base directory set from the API', async () => {
      const cacheDir = path.join(outsideDir, 'api-cache')
      await run('[plantuml,c]\n....\nalice\n....\n', {
        attributes: {
          'kroki-fetch-diagram': '',
          'kroki-server-url': imageServerUrl,
          'kroki-cache-dir': cacheDir,
          imagesoutdir: path.join(baseDir, 'images'),
        },
      })
      assert.ok(fs.readdirSync(cacheDir).length > 0)
    })
    test('rejects a format that contains a path separator', async () => {
      const { html } = await run(
        '[plantuml,name,../../evil]\n....\nalice\n....\n',
        {
          attributes: {
            ...fetchAttributes(),
            'kroki-server-url': imageServerUrl,
          },
        },
      )
      assert.ok(html.includes('kroki-error'), html)
      assert.ok(!fs.existsSync(path.join(baseDir, 'evil')))
    })
    test('keeps a plain diagram name', async () => {
      const { html } = await run('[plantuml,plain]\n....\nalice\n....\n', {
        attributes: {
          ...fetchAttributes(),
          'kroki-server-url': imageServerUrl,
        },
      })
      assert.match(html, /plain\.svg"/)
      assert.ok(fs.existsSync(path.join(baseDir, 'images', 'plain.svg')))
    })
  })

  describe('block macro errors', () => {
    test('renders a kroki-error paragraph with the title and the role, and without the absolute path', async () => {
      const { html, logs } = await run(
        '.A title\nplantuml::missing.puml[role=sequence]\n',
      )
      assert.ok(html.includes('class="paragraph sequence kroki-error"'), html)
      assert.ok(html.includes('A title'), html)
      assert.ok(
        html.includes('Unresolved block macro - plantuml::missing.puml[]'),
        html,
      )
      assert.ok(!html.includes(baseDir), html)
      assert.ok(
        logs.some((log) => log.includes('Skipping plantuml block')),
        logs.join('\n'),
      )
    })
  })
})
