// @ts-check

import assert from 'node:assert'
import { describe, mock, test } from 'node:test'
import { load } from '@asciidoctor/core'
import httpClient, { HttpError } from '../src/http-client.js'
import { KrokiClient, KrokiDiagram } from '../src/kroki-client.js'
import { referenceEncode } from './reference-encode.js'

describe('KrokiDiagram', () => {
  // KrokiDiagram#encode must be isomorphic: it cannot rely on the Node-only `Buffer`
  // because a real browser (VS Code for the Web / vscode.dev) has none. The browser
  // test setup no longer polyfills Buffer, so this suite runs Buffer-free there. The
  // expected value is derived from the diagram text by an independent, Buffer-free
  // reference (see reference-encode.js).
  describe('encode', () => {
    for (const [label, text] of [
      ['ASCII diagram source', 'alice -> bob'],
      ['empty source', ''],
      ['accented characters', 'Café -> Système: déjà'],
      ['multi-byte emoji', 'Alice 🚀 -> Bob 🐛: héllo'],
    ]) {
      test(`encodes ${label}`, () => {
        const diagram = new KrokiDiagram('plantuml', 'svg', text, {})
        assert.strictEqual(diagram.encode(), referenceEncode(text))
      })
    }
  })

  describe('getDiagramUri', () => {
    test('URL-encodes both key and value of diagram options', () => {
      const diagram = new KrokiDiagram('plantuml', 'svg', 'alice -> bob', {
        theme: 'forest',
      })
      const uri = diagram.getDiagramUri('https://kroki.io')
      assert.ok(
        uri.includes('?theme=forest'),
        `Expected ?theme=forest in URI: ${uri}`,
      )
    })

    test('URL-encodes keys containing special characters', () => {
      const diagram = new KrokiDiagram('plantuml', 'svg', 'alice -> bob', {
        'theme&other': 'value',
      })
      const uri = diagram.getDiagramUri('https://kroki.io')
      assert.ok(
        !uri.includes('theme&other'),
        `Expected raw & to be encoded in URI key: ${uri}`,
      )
      assert.ok(
        uri.includes('theme%26other=value'),
        `Expected theme%26other=value in URI: ${uri}`,
      )
    })

    test('URL-encodes values containing special characters', () => {
      const diagram = new KrokiDiagram('plantuml', 'svg', 'alice -> bob', {
        theme: 'my theme/value',
      })
      const uri = diagram.getDiagramUri('https://kroki.io')
      assert.ok(
        uri.includes('theme=my%20theme%2Fvalue'),
        `Expected encoded value in URI: ${uri}`,
      )
    })

    test('removes a trailing slash from the server URL', () => {
      const diagram = new KrokiDiagram('vegalite', 'png', '{}', {})
      assert.strictEqual(
        diagram.getDiagramUri('https://my.domain.org/kroki/'),
        'https://my.domain.org/kroki/vegalite/png/eNqrrgUAAXUA-Q==',
      )
    })

    test('removes trailing slashes from the server URL', () => {
      const diagram = new KrokiDiagram('vegalite', 'png', '{}', {})
      assert.strictEqual(
        diagram.getDiagramUri('https://my-server/kroki//'),
        'https://my-server/kroki/vegalite/png/eNqrrgUAAXUA-Q==',
      )
    })
  })
})

describe('Kroki HTTP client', () => {
  describe('kroki-http-method attribute', () => {
    test('forces POST when kroki-http-method is "post"', async () => {
      const doc = await load('', {
        attributes: { 'kroki-http-method': 'post' },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.method, 'post')
    })
    test('forces GET when kroki-http-method is "get"', async () => {
      const doc = await load('', {
        attributes: { 'kroki-http-method': 'get' },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.method, 'get')
    })
    test('falls back to adaptive when kroki-http-method has an invalid value', async () => {
      const doc = await load('', {
        attributes: { 'kroki-http-method': 'delete' },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.method, 'adaptive')
    })
    test('uses adaptive when kroki-http-method is "adaptive"', async () => {
      const doc = await load('', {
        attributes: { 'kroki-http-method': 'adaptive' },
      })
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.method, 'adaptive')
    })
    test('defaults to adaptive when kroki-http-method is not set', async () => {
      const doc = await load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.method, 'adaptive')
    })
  })

  describe('kroki-max-uri-length attribute', () => {
    test('defaults to 4000 when kroki-max-uri-length is not set', async () => {
      const doc = await load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.maxUriLength, 4000)
    })
    test('falls back to 4000 when kroki-max-uri-length is not a number', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-max-uri-length', 'foo')
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.maxUriLength, 4000)
    })
    test('uses the numeric kroki-max-uri-length value', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-max-uri-length', '8000')
      const krokiClient = new KrokiClient(doc, httpClient)
      assert.strictEqual(krokiClient.maxUriLength, 8000)
    })
  })

  describe('GET mode', () => {
    test('emits a warning when the diagram URI exceeds kroki-max-uri-length', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-http-method', 'get')
      doc.setAttribute('kroki-max-uri-length', '10')
      const warnings = []
      const logger = doc.getLogger()
      mock.method(logger, 'warn', (msg) => warnings.push(msg))
      try {
        const krokiClient = new KrokiClient(doc, {
          get: (uri) => `GET ${uri}`,
          post: (uri, body) => `POST ${uri} - ${body}`,
        })
        const krokiDiagram = {
          type: 'type',
          format: 'format',
          text: 'text',
          opts: {},
          getDiagramUri: () => 'diagram-uri', // length: 11
        }
        await krokiClient.getImage(krokiDiagram)
        assert.strictEqual(warnings.length, 1)
        assert.ok(warnings[0].includes('414'), warnings[0])
        assert.ok(warnings[0].includes('kroki-http-method'), warnings[0])
      } finally {
        mock.restoreAll()
      }
    })
  })

  describe('Adaptive mode', () => {
    test('uses POST when the diagram URI exceeds kroki-max-uri-length', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-max-uri-length', '10')
      const krokiClient = new KrokiClient(doc, {
        get: (uri) => `GET ${uri}`,
        post: (uri, body) => `POST ${uri} - ${body}`,
      })
      const krokiDiagram = {
        type: 'type',
        format: 'format',
        text: 'text',
        opts: {},
        getDiagramUri: () => 'diagram-uri', // length: 11
      }
      const image = await krokiClient.getImage(krokiDiagram)
      assert.strictEqual(image, 'POST https://kroki.io/type/format - text')
    })
    test('uses GET when the diagram URI is within kroki-max-uri-length', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-max-uri-length', '11')
      const krokiClient = new KrokiClient(doc, {
        get: (uri) => `GET ${uri}`,
        post: (uri, body) => `POST ${uri} - ${body}`,
      })
      const krokiDiagram = {
        type: 'type',
        format: 'format',
        text: 'text',
        opts: {},
        getDiagramUri: () => 'diagram-uri', // length: 11
      }
      const image = await krokiClient.getImage(krokiDiagram)
      assert.strictEqual(image, 'GET diagram-uri')
    })
  })

  describe('request headers', () => {
    test('accepts application/json, so that the server returns an error as JSON', async () => {
      const requests = []
      const krokiClient = new KrokiClient(await load(''), {
        get: async (_uri, headers) => {
          requests.push(headers)
          return ''
        },
        post: async (_uri, _body, headers) => {
          requests.push(headers)
          return ''
        },
      })
      const krokiDiagram = {
        type: 'plantuml',
        format: 'svg',
        text: 'alice -> bob',
        opts: {},
        getDiagramUri: () => 'https://kroki.io/plantuml/svg/encoded',
      }
      await krokiClient.getImage(krokiDiagram)
      krokiClient.method = 'post'
      await krokiClient.getImage(krokiDiagram)
      assert.strictEqual(requests.length, 2)
      for (const headers of requests) {
        assert.strictEqual(headers.Accept, 'application/json')
      }
    })
  })

  describe('error messages', () => {
    test('identifies a failed GET request without the encoded diagram', async () => {
      const doc = await load('')
      const uri =
        'https://kroki.io/plantuml/svg/SyfFKj2rKt3CoKnELR1Io4ZDoSa70000'
      const cause = new Error(`GET ${uri} - server returns 400 status code`)
      const krokiClient = new KrokiClient(doc, {
        get: async () => {
          throw cause
        },
        post: async () => '',
      })
      const krokiDiagram = {
        type: 'plantuml',
        format: 'svg',
        text: 'alice -> bob',
        opts: {},
        getDiagramUri: () => uri,
      }
      await assert.rejects(
        () => krokiClient.getImage(krokiDiagram),
        (err) => {
          assert.strictEqual(
            err.message,
            'GET https://kroki.io/plantuml/svg - server returns 400 status code',
          )
          assert.strictEqual(err.cause, cause)
          return true
        },
      )
    })
    test('keeps the fields of an HttpError when it shortens the URI', async () => {
      const doc = await load('')
      const uri =
        'https://kroki.io/plantuml/svg/SyfFKj2rKt3CoKnELR1Io4ZDoSa70000'
      const cause = new HttpError(
        'http',
        'GET',
        uri,
        'server returns 400 status code; response: Syntax Error?',
        { status: 400, serverMessage: 'Syntax Error?' },
      )
      const krokiClient = new KrokiClient(doc, {
        get: async () => {
          throw cause
        },
        post: async () => '',
      })
      const krokiDiagram = {
        type: 'plantuml',
        format: 'svg',
        text: 'alice -> bob',
        opts: {},
        getDiagramUri: () => uri,
      }
      await assert.rejects(
        () => krokiClient.getImage(krokiDiagram),
        (err) => {
          assert.ok(err instanceof HttpError)
          assert.strictEqual(err.type, 'http')
          assert.strictEqual(err.url, 'https://kroki.io/plantuml/svg')
          assert.strictEqual(err.status, 400)
          assert.strictEqual(err.serverMessage, 'Syntax Error?')
          assert.strictEqual(
            err.message,
            'GET https://kroki.io/plantuml/svg - server returns 400 status code; response: Syntax Error?',
          )
          return true
        },
      )
    })
    test('rethrows an error that does not contain the request URI unchanged', async () => {
      const doc = await load('')
      const error = new Error('something else')
      const krokiClient = new KrokiClient(doc, {
        get: async () => {
          throw error
        },
        post: async () => '',
      })
      const krokiDiagram = {
        type: 'plantuml',
        format: 'svg',
        text: 'alice -> bob',
        opts: {},
        getDiagramUri: () => 'https://kroki.io/plantuml/svg/encoded',
      }
      await assert.rejects(() => krokiClient.getImage(krokiDiagram), error)
    })
  })

  describe('POST mode', () => {
    test('removes trailing slashes from the server URL', async () => {
      const doc = await load('')
      doc.setAttribute('kroki-http-method', 'post')
      doc.setAttribute('kroki-server-url', 'https://my-server/kroki//')
      const krokiClient = new KrokiClient(doc, {
        get: (uri) => `GET ${uri}`,
        post: (uri, body) => `POST ${uri} - ${body}`,
      })
      const krokiDiagram = {
        type: 'type',
        format: 'format',
        text: 'text',
        opts: {},
        getDiagramUri: () => 'diagram-uri',
      }
      const image = await krokiClient.getImage(krokiDiagram)
      assert.strictEqual(
        image,
        'POST https://my-server/kroki/type/format - text',
      )
    })
  })
})
