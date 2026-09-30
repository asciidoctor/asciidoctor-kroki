import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { Extensions, load } from '@asciidoctor/core'
import sinon from 'sinon'
import http from '../../src/http-client.js'
import { register } from '../../src/index.js'

describe('Ditaa separation compatibility', () => {
  const diagram = readFileSync(
    new URL('../fixtures/adjacent-boxes.ditaa', import.meta.url),
    'utf8',
  )
  const cases = [
    ['ditaa', '', {}],
    ['ditaa', 'separation=false', { 'no-separation': 'true' }],
    ['ditaa', 'separation=true', {}],
    ['ditaa', 'no-separation=true', { 'no-separation': 'true' }],
    ['ditaa', 'no-separation=false', { 'no-separation': 'false' }],
    [
      'ditaa',
      'separation=false,no-separation=false',
      { 'no-separation': 'false' },
    ],
    [
      'ditaa',
      'no-separation=true,separation=true',
      { 'no-separation': 'true' },
    ],
    [
      'ditaa',
      'separation=false,scale=2',
      { 'no-separation': 'true', scale: '2' },
    ],
    ['plantuml', 'separation=false', { separation: 'false' }],
  ]

  for (const [type, options, expected] of cases) {
    test(`${type} ${options || 'default'}`, async (t) => {
      const get = sinon.stub(http, 'get').resolves('<svg/>')
      t.after(() => {
        get.restore()
      })
      const registry = Extensions.create()
      register(registry)
      const doc = await load(
        `[${type},defer,svg,${options}]\n----\n${diagram}----`,
        {
          safe: 'safe',
          extension_registry: registry,
          attributes: {
            'kroki-fetch-diagram': '',
            'kroki-data-uri': '',
            'kroki-cache': 'false',
            'kroki-http-method': 'get',
          },
        },
      )
      const image = doc.findBy({ context: 'image' })[0]
      assert.ok(image)
      assert.strictEqual(get.callCount, 1)
      const [uri, headers] = get.firstCall.args
      assert.deepStrictEqual(
        Object.fromEntries(
          Object.entries(headers).filter(([key]) =>
            key.startsWith('Kroki-Diagram-Options-'),
          ),
        ),
        Object.fromEntries(
          Object.entries(expected).map(([key, value]) => [
            `Kroki-Diagram-Options-${key}`,
            value,
          ]),
        ),
      )
      assert.deepStrictEqual(
        Object.fromEntries(new URL(uri).searchParams),
        expected,
      )
      assert.strictEqual(
        image.getAttribute('target'),
        'data:image/svg+xml;base64,PHN2Zy8+',
      )
    })
  }
})
