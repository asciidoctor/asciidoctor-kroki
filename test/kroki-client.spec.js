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

describe('Kroki HTTP client', () => {
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
  })
  describe('Adaptive mode', () => {
    it('should get an image with GET request if the URI length is <= 4096', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram('vegalite', 'svg', readFixture('chart.vlite'))
      const image = krokiClient.getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'chart.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      expect(image).to.equal(expected)
    }).timeout(5000)
    it('should get an image with POST request if the URI length is > 4096', () => {
      const doc = asciidoctor.load('')
      const krokiClient = new KrokiClient(doc, httpClient)
      const krokiDiagram = new KrokiDiagram('vegalite', 'svg', readFixture('cars-repeated-charts.vlite'))
      const image = krokiClient.getImage(krokiDiagram)
        .replace(/\r/, '')
        .replace(/\n/, '')
      const expected = readFixture('expected', 'cars-repeated-charts.svg')
        .replace(/\r/, '')
        .replace(/\n/, '')
      expect(image).to.equal(expected)
    }).timeout(5000)
  })
})
