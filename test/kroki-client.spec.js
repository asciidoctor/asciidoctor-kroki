/* global describe it */
// @ts-check
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')
chai.use(dirtyChai)

const { readFixture } = require('./utils.js')
const { KrokiClient, KrokiDiagram } = require('../src/kroki-client.js')
const httpClient = require('../src/http/node-http.js')
const asciidoctor = require('@asciidoctor/core')()

describe('Kroki HTTP client', function () {
  this.timeout(30000)
  describe('kroki-http-method attribute', () => {
    it('should use post method when kroki-http-method value is post', () => {
      const doc = asciidoctor.load('', { attributes: { 'kroki-http-method': 'post' } })
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('post')
    })
    it('should use get method when kroki-http-method value is get', () => {
      const doc = asciidoctor.load('', { attributes: { 'kroki-http-method': 'get' } })
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('get')
    })
    it('should use adaptive method when kroki-http-method value is invalid', () => {
      const doc = asciidoctor.load('', { attributes: { 'kroki-http-method': 'delete' } })
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('adaptive')
    })
    it('should use adaptive method when kroki-http-method is adaptive', () => {
      const doc = asciidoctor.load('', { attributes: { 'kroki-http-method': 'adaptive' } })
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('adaptive')
    })
    it('should use adaptive method when kroki-http-method is undefined', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('adaptive')
    })
    it('should use adaptive method when kroki-http-method is undefined', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.method).to.equal('adaptive')
    })
  })
  describe('kroki-max-uri-length attribute', () => {
    it('should use the default value (4000) when kroki-max-uri-length is undefined', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.maxUriLength).to.equal(4000)
    })
    it('should use the default value (4000) when kroki-max-uri-length is invalid', () => {
      const doc = asciidoctor.load('')
      doc.setAttribute('kroki-max-uri-length', 'foo')
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.maxUriLength).to.equal(4000)
    })
    it('should use a custom value when kroki-max-uri-length is a number', () => {
      const doc = asciidoctor.load('')
      doc.setAttribute('kroki-max-uri-length', '8000')
      const krokiClient = new KrokiClient(doc, httpClient)
      expect(krokiClient.maxUriLength).to.equal(8000)
    })
  })
  describe('Adaptive mode', () => {
    it('should get an image with GET request if the URI length is <= 4000', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram('vegalite', 'svg', readFixture('chart.vlite'), {})
      const image = krokiClient.getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'chart.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      expect(image).to.equal(expected)
    })
    it('should get an image with POST request if the URI length is > 4000', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram('vegalite', 'svg', readFixture('cars-repeated-charts.vlite'), {})
      const image = krokiClient.getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'cars-repeated-charts.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      expect(image).to.equal(expected)
    })
    it('should get an image with POST request if the URI length is greater than the value configured', () => {
      const doc = asciidoctor.load('')
      doc.setAttribute('kroki-max-uri-length', '10')
      const krokiClient = new KrokiClient(doc, {
        get: (uri) => `GET ${uri}`,
        post: (uri, body) => `POST ${uri} - ${body}`
      })
      const krokiDiagram = {
        type: 'type',
        format: 'format',
        text: 'text',
        opts: {},
        getDiagramUri: () => 'diagram-uri' // length: 11
      }
      const image = krokiClient.getImage(krokiDiagram)
      expect(image).to.equal('POST https://kroki.io/type/format - text')
    })
    it('should get an image with GET request if the URI length is lower or equals than the value configured', () => {
      const doc = asciidoctor.load('')
      doc.setAttribute('kroki-max-uri-length', '11')
      const krokiClient = new KrokiClient(doc, {
        get: (uri) => `GET ${uri}`,
        post: (uri, body) => `POST ${uri} - ${body}`
      })
      const krokiDiagram = {
        type: 'type',
        format: 'format',
        text: 'text',
        opts: {},
        getDiagramUri: () => 'diagram-uri' // length: 11
      }
      const image = krokiClient.getImage(krokiDiagram)
      expect(image).to.equal('GET diagram-uri')
    })
  })
})
