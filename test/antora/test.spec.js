/* global describe it before */
const fs = require('fs')
const cheerio = require('cheerio')
const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-string'))
chai.use(require('dirty-chai'))

const generateSite = require('@antora/site-generator-default')

describe('Antora integration (local)', function () {
  this.timeout(90000)
  before(async () => {
    fs.rmSync(`${__dirname}/public`, { recursive: true, force: true })
    await generateSite([`--playbook=${__dirname}/site.yml`])
  })
  it('should generate a site with diagrams', () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElements = $('img')
    expect(imageElements.length).to.equal(9)
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
  it('should resolve included diagrams from subfolders when using plantuml::partial$subfolder/xxx.puml[] macro', async () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElement = $('img[alt*=ab-inc-sub-partial-1]')
    expect(imageElement.length).to.equal(1)
    const src = imageElement.attr('src')
    const diagramContents = fs.readFileSync(`${__dirname}/public/antora-kroki/${src}`).toString()
    expect(diagramContents).includes('alice')
    expect(diagramContents).includes('bob')
  })
  it('should resolve included diagrams when using structurizr::partial$xxx.dsl[] macro', async () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElement = $('img[alt*=ab-inc-partial-2]')
    expect(imageElement.length).to.equal(1)
    const src = imageElement.attr('src')
    const diagramContents = fs.readFileSync(`${__dirname}/public/antora-kroki/${src}`).toString()
    expect(diagramContents).includes('User')
    expect(diagramContents).includes('Software System')
  })
})

describe('Antora integration (remote)', function () {
  this.timeout(90000)
  before(async () => {
    fs.rmSync(`${__dirname}/public`, { recursive: true, force: true })
    await generateSite([`--playbook=${__dirname}/site-remote.yml`])
  })
  it('should generate a site with diagrams', () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElements = $('img')
    expect(imageElements.length).to.equal(9)
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
  it('should resolve included diagrams when using structurizr::partial$xxx.dsl[] macro', async () => {
    const $ = cheerio.load(fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`))
    const imageElement = $('img[alt*=ab-inc-partial-2]')
    expect(imageElement.length).to.equal(1)
    const src = imageElement.attr('src')
    const diagramContents = fs.readFileSync(`${__dirname}/public/antora-kroki/${src}`).toString()
    expect(diagramContents).includes('User')
    expect(diagramContents).includes('Software System')
  })
})
