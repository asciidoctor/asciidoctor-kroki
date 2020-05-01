// @ts-check
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const { preprocessVegaLite } = require('../src/preprocess.js')

describe('preprocessVegaLite', () => {
  it('should return original diagramText for invalid JSON', () => {
    const invalidJson = 'invalid JSON'
    expect(preprocessVegaLite(invalidJson, undefined)).to.be.equal(invalidJson)
  })

  it('should return original diagramText for valid JSON but without "data.url"', () => {
    const validJsonWithoutDataUrl = '{}'
    expect(preprocessVegaLite(validJsonWithoutDataUrl, undefined)).to.be.equal(validJsonWithoutDataUrl)
  })

  it('should return original diagramText for unexisting file referenced with "data.url"', () => {
    const unexistingReferencedFile = `{
      "data": {
        "url": "unexisting.csv"
      }
    }`
    expect(preprocessVegaLite(unexistingReferencedFile, {})).to.be.equal(unexistingReferencedFile)
  })

  it('should return diagramText with inlined local file referenced with "data.url"', () => {
    const referencedLocalCsvFile = `{
  "data": {
    "url": "test/fixtures/vegalite-data.csv"
  }
}`
    const inlinedLocalCsvFile = String.raw`{
  "data": {
    "values": "a,b,c\n2020-01-05,0.3,C1\n2020-01-15,0.7,C1\n2020-01-05,0.5,C2\n2020-01-15,0.8,C2\n",
    "format": {
      "type": "csv"
    }
  }
}`
    expect(preprocessVegaLite(referencedLocalCsvFile, {})).to.be.equal(inlinedLocalCsvFile)
  })

  // TODO "url" should be https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/test/fixtures/vegalite-data.csv
  // or could be deleted
  it('should return diagramText with inlined remote file referenced with "data.url"', () => {
    const referencedRemoteCsvFile = `{
  "data": {
    "url": "https://raw.githubusercontent.com/stenzengel/asciidoctor-kroki/issue-53-inline-referenced-vegalite-data-file/test/fixtures/vegalite-data.csv"
  }
}`
    const inlinedRemoteCsvFile = String.raw`{
  "data": {
    "values": "a,b,c\n2020-01-05,0.3,C1\n2020-01-15,0.7,C1\n2020-01-05,0.5,C2\n2020-01-15,0.8,C2\n",
    "format": {
      "type": "csv"
    }
  }
}`
    expect(preprocessVegaLite(referencedRemoteCsvFile, {})).to.be.equal(inlinedRemoteCsvFile)
  })

})

