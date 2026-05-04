const { describe, it, before } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const cheerio = require('cheerio')

const generateSite = require('@antora/site-generator-default')

describe('Antora integration (local)', { timeout: 90000 }, () => {
  before(async () => {
    fs.rmSync(`${__dirname}/public`, { recursive: true, force: true })
    await generateSite([`--playbook=${__dirname}/site.yml`])
  })
  it('should generate a site with diagrams', () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElements = $('img')
    assert.strictEqual(imageElements.length, 9)
    imageElements.each((_i, imageElement) => {
      const src = $(imageElement).attr('src')
      assert.ok(src.startsWith('_images/ab-'))
    })
  })
  it('should resolve included diagrams when using plantuml::partial$xxx.puml[] macro', async () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElement = $('img[alt*=ab-inc-partial-1]')
    assert.strictEqual(imageElement.length, 1)
    const src = imageElement.attr('src')
    const diagramContents = fs
      .readFileSync(`${__dirname}/public/antora-kroki/${src}`)
      .toString()
    assert.ok(diagramContents.includes('alice'))
    assert.ok(diagramContents.includes('bob'))
  })
  it('should resolve included diagrams from subfolders when using plantuml::partial$subfolder/xxx.puml[] macro', async () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElement = $('img[alt*=ab-inc-sub-partial-1]')
    assert.strictEqual(imageElement.length, 1)
    const src = imageElement.attr('src')
    const diagramContents = fs
      .readFileSync(`${__dirname}/public/antora-kroki/${src}`)
      .toString()
    assert.ok(diagramContents.includes('alice'))
    assert.ok(diagramContents.includes('bob'))
  })
  it('should resolve included diagrams when using structurizr::partial$xxx.dsl[] macro', async () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElement = $('img[alt*=ab-inc-partial-2]')
    assert.strictEqual(imageElement.length, 1)
    const src = imageElement.attr('src')
    const diagramContents = fs
      .readFileSync(`${__dirname}/public/antora-kroki/${src}`)
      .toString()
    assert.ok(diagramContents.includes('User'))
    assert.ok(diagramContents.includes('Software System'))
  })
})

describe('Antora integration (remote)', { timeout: 90000 }, () => {
  before(async () => {
    fs.rmSync(`${__dirname}/public`, { recursive: true, force: true })
    await generateSite([`--playbook=${__dirname}/site-remote.yml`])
  })
  it('should generate a site with diagrams', () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElements = $('img')
    assert.strictEqual(imageElements.length, 9)
    imageElements.each((_i, imageElement) => {
      const src = $(imageElement).attr('src')
      assert.ok(src.startsWith('_images/ab-'))
    })
  })
  it('should resolve included diagrams when using plantuml::partial$xxx.puml[] macro', async () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElement = $('img[alt*=ab-inc-partial-1]')
    assert.strictEqual(imageElement.length, 1)
    const src = imageElement.attr('src')
    const diagramContents = fs
      .readFileSync(`${__dirname}/public/antora-kroki/${src}`)
      .toString()
    assert.ok(diagramContents.includes('alice'))
    assert.ok(diagramContents.includes('bob'))
  })
  it('should resolve included diagrams when using structurizr::partial$xxx.dsl[] macro', async () => {
    const $ = cheerio.load(
      fs.readFileSync(`${__dirname}/public/antora-kroki/source-location.html`),
    )
    const imageElement = $('img[alt*=ab-inc-partial-2]')
    assert.strictEqual(imageElement.length, 1)
    const src = imageElement.attr('src')
    const diagramContents = fs
      .readFileSync(`${__dirname}/public/antora-kroki/${src}`)
      .toString()
    assert.ok(diagramContents.includes('User'))
    assert.ok(diagramContents.includes('Software System'))
  })
})