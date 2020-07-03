/* global describe it beforeEach */
const fs = require('fs')
const rimrafSync = require('rimraf')
const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-string'))
chai.use(require('dirty-chai'))

const generateSite = require('@antora/site-generator-default')

describe('Antora integration', () => {
  beforeEach(() => {
    rimrafSync(`${__dirname}/public`, function (error) {})
  })
  it('should generate a site with diagrams', async () => {
    await generateSite([`--playbook=${__dirname}/site.yml`])
    const cheerio = require('cheerio')
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/sourcelocation.html`))
    const imageElements = $('img')
    expect(imageElements.length).to.equal(6)
    imageElements.each((i, imageElement) => {
      const src = $(imageElement).attr('src')
      expect(src).to.startWith('_images/diag-')
    })
  }).timeout(10000)
})
