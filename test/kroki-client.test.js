// @ts-check

import assert from 'node:assert'
import { describe, test } from 'node:test'
import { load } from '@asciidoctor/core'
import httpClient from '../src/http/http-client.js'
import { KrokiClient } from '../src/kroki-client.js'

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