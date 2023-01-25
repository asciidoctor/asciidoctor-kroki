/* global describe it beforeEach */
const fs = require('fs')
const cheerio = require('cheerio')
const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-string'))
chai.use(require('dirty-chai'))

const generateSite = require('@antora/site-generator-default')

describe('Antora integration', function () {
  this.timeout(50000)
  before(async () => {
    fs.rmSync(`${__dirname}/public`, { recursive: true, force: true })
    await generateSite([`--playbook=${__dirname}/site.yml`])
  })
  it('should generate a site with diagrams', () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElements = $('img')
    expect(imageElements.length).to.equal(7)
    imageElements.each((i, imageElement) => {
      const src = $(imageElement).attr('src')
      expect(src).to.startWith('_images/ab-')
    })
  })
  it('should resolve included diagrams when using plantuml::partial$xxx.puml[] macro', async () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElement = $('img[alt*=ab-inc-partial-1]')
    expect(imageElement.length).to.equal(1)
    const src = imageElement.attr('src')
    const diagramContents = fs.readFileSync(`${__dirname}/public/antora-kroki/${src}`).toString()
    expect(diagramContents).includes('alice')
    expect(diagramContents).includes('bob')
  })
})
