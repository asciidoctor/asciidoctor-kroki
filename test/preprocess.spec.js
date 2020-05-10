/* global describe it */
// @ts-check
const fs = require('fs')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const { preprocessVegaLite } = require('../src/preprocess.js')

describe('preprocessVegaLite', () => {
  it('should throw an error for invalid JSON', () => {
    const errorMessage = `Preprocessing of Vega-Lite view specification failed, because of a parsing error:
SyntaxError: JSON5: invalid character 'i' at 1:1
The invalid view specification was:
invalid JSON`

    expect(() => preprocessVegaLite('invalid JSON', {})).to.throw(errorMessage)
  })

  it('should return original diagramText for valid JSON but without "data.url"', () => {
    const validJsonWithoutDataUrl = '{}'
    expect(preprocessVegaLite(validJsonWithoutDataUrl, {})).to.be.equal(validJsonWithoutDataUrl)
  })

  it('should throw an error for unexisting local file referenced with relative path', () => {
    const unexistingLocalReferencedFile = `{
  "data": {
    "url": "unexisting.csv"
  }
}`
    const errorMessage = `Preprocessing of Vega-Lite view specification failed, because reading the referenced local file 'unexisting.csv' caused an error:
Error: ENOENT: no such file or directory, open 'unexisting.csv'`

    expect(() => preprocessVegaLite(unexistingLocalReferencedFile, {})).to.throw(errorMessage)
  })

  it('should throw an error for unexisting local file referenced with "file://"', () => {
    const unexistingLocalReferencedFile = `{
      "data": {
        "url": "file://unexisting.csv"
      }
    }`
    const errorMessage = `Preprocessing of Vega-Lite view specification failed, because reading the referenced local file 'file://unexisting.csv' caused an error:
Error: ENOENT: no such file or directory, open 'unexisting.csv'`

    expect(() => preprocessVegaLite(unexistingLocalReferencedFile, {})).to.throw(errorMessage)
  })

  it('should warn and return original diagramText for unexisting remote file referenced with "data.url", because it can perhaps be found by kroki server', () => {
    const unexistingRemoteReferencedFile = `{
  "data": {
    "url": "https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/unexisting.csv"
  }
}`
    expect(preprocessVegaLite(unexistingRemoteReferencedFile, {})).to.be.equal(unexistingRemoteReferencedFile)
  })

  it('should return diagramText with inlined local file referenced with "data.url"', () => {
    const referencedLocalCsvFile = `{
  "data": {
    "url": "test/fixtures/vegalite-data.csv"
  }
}`
    const values = fs.readFileSync(`${__dirname}/fixtures/vegalite-data.csv`, 'utf8')
    const inlinedLocalCsvFile = JSON.stringify({
      data: {
        values,
        format: {
          type: 'csv'
        }
      }
    })
    expect(preprocessVegaLite(referencedLocalCsvFile, {})).to.be.equal(inlinedLocalCsvFile)
  })

  it('should return diagramText with inlined remote file referenced with "data.url"', () => {
    const referencedRemoteCsvFile = `{
  "data": {
    "url": "https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/test/fixtures/vegalite-data.csv"
  }
}`
    const inlinedRemoteCsvFile = String.raw`{"data":{"values":"a,b,c\n2020-01-05,0.3,C1\n2020-01-15,0.7,C1\n2020-01-05,0.5,C2\n2020-01-15,0.8,C2\n","format":{"type":"csv"}}}`
    expect(preprocessVegaLite(referencedRemoteCsvFile, {})).to.be.equal(inlinedRemoteCsvFile)
  })
})
