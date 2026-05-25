// @ts-check

import assert from 'node:assert'
import { describe, mock, test } from 'node:test'
import { load } from '@asciidoctor/core'
import httpClient from '../src/http-client.js'
import { KrokiClient, KrokiDiagram } from '../src/kroki-client.js'

describe('KrokiDiagram', () => {
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
})
