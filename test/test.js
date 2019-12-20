/* global describe it before */
const chai = require('chai')
const sinon = require('sinon')
const rimraf = require('rimraf')
const http = require('../src/node-http')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const asciidoctorKroki = require('../src/asciidoctor-kroki.js')
const asciidoctor = require('@asciidoctor/core')()

describe('Registration', () => {
  it('should register the extension', () => {
    const registry = asciidoctor.Extensions.create()
    expect(registry['$block_macros?']()).to.be.false()
    asciidoctorKroki.register(registry)
    expect(registry['$block_macros?']()).to.be.true()
    expect(registry['$registered_for_block_macro?']('plantuml')).to.be.an('object')
  })
})

describe('Conversion', () => {
  before(() => {
    rimraf.sync(`${__dirname}/../.asciidoctor/kroki/*`)
  })

  describe('When extension is registered', () => {
    it('should convert a diagram to an image', () => {
      const input = `
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=')
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    })
    it('should convert a diagram with an absolute path to an image', () => {
      const input = `plantuml::${__dirname}/fixtures/alice.puml[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/plantuml/svg/eNpzKC5JLCopzc3hSszJTE5V0LVTSMpP4nJIzUsBCQIAr3EKfA==')
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    })
    it('should convert a diagram with a relative path to an image', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain('<img src=".asciidoctor/kroki/3b6025d05a9642fd93791b9eed064448bee17803.svg" alt="diagram">')
    })
    it('should download and save an image to a local folder', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

[plantuml,hello-world,svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain('<img src=".asciidoctor/kroki/7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="hello-world">')
    })
    it('should apply substitutions in diagram block', () => {
      const input = `
:action: generates

[blockdiag,block-diag,svg,subs=+attributes]
----
blockdiag {
  Kroki -> {action} -> "Block diagrams";
  Kroki -> is -> "very easy!";

  Kroki [color = "greenyellow"];
  "Block diagrams" [color = "pink"];
  "very easy!" [color = "orange"];
}
----
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('<img src="https://kroki.io/blockdiag/svg/eNpdzDEKQjEQhOHeU4zpPYFoYesRxGJ9bwghMSsbUYJ4d10UCZbDfPynolOek0Q8FsDeNCestoisNLmy-Qg7R3Blcm5hPcr0ITdaB6X15fv-_YdJixo2CNHI2lmK3sPRA__RwV5SzV80ZAegJjXSyfMFptc71w==" alt="block-diag">')
    })
    it('should apply attributes substitution in target', () => {
      const input = `
:fixtures-dir: test/fixtures
:imagesdir: .asciidoctor/kroki

plantuml::{fixtures-dir}/alice.puml[svg,role=sequence]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain('<img src=".asciidoctor/kroki/3b6025d05a9642fd93791b9eed064448bee17803.svg" alt="diagram">')
    })
    it('should not download twice the same image', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

[plantuml,asciidoc-html5,svg,role=sequence]
....
AsciiDoc -> HTML5: convert
....
`
      sinon.spy(http, 'get')
      try {
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, { extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
        expect(html).to.contain('<img src=".asciidoctor/kroki/ea85be88a0e4e5fb02f59602af7fe207feb5b904.svg" alt="asciidoc-html5">')
        expect(http.get.calledOnce).to.be.true()
      } finally {
        http.get.restore()
      }
    })
    it('should create a literal block when format is txt', () => {
      const input = `
[plantuml,format=txt]
....
Bob->Alice : hello
....
`
      sinon.spy(http, 'get')
      try {
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, { extension_registry: registry })
        expect(html).to.contain('pre>     ,---.          ,-----.\n' +
          '     |Bob|          |Alice|\n' +
          '     `-+-\'          `--+--\'\n' +
          '       |    hello      |\n' +
          '       |--------------&gt;|\n' +
          '     ,-+-.          ,--+--.\n' +
          '     |Bob|          |Alice|\n' +
          '     `---\'          `-----\'</pre>')
        expect(http.get.calledOnce).to.be.true()
      } finally {
        http.get.restore()
      }
    })
    it('should read diagram text', () => {
      const input = `
[plantuml]
....
[A] B [C]
paragraph
....`
      const defaultLogger = asciidoctor.LoggerManager.getLogger()
      const memoryLogger = asciidoctor.MemoryLogger.create()
      try {
        asciidoctor.LoggerManager.setLogger(memoryLogger)
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, { extension_registry: registry })
        expect(html).to.contain('<img src="https://kroki.io/plantuml/svg/eNqLdoxVcFKIdo7lKkgsSkwvSizIAAA36QY3" alt="diagram">')
        expect(memoryLogger.getMessages().length).to.equal(0)
      } finally {
        asciidoctor.LoggerManager.setLogger(defaultLogger)
      }
    })
    it('should inline svg image with built-in uri-read (available in Asciidoctor.js 2+)', () => {
      const input = `
plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=inline]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'allow-uri-read': true } })
      expect(html).to.contain(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" contentScriptType="application/ecmascript" contentStyleType="text/css" height="113px" preserveAspectRatio="none" style="width:112px;height:113px;" version="1.1" viewBox="0 0 112 113" width="112px" zoomAndPan="magnify"><defs><filter height="300%" id="f1keim8oeuimdl" width="300%" x="-1" y="-1"><feGaussianBlur result="blurOut" stdDeviation="2.0"/><feColorMatrix in="blurOut" result="blurOut2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/><feOffset dx="4.0" dy="4.0" in="blurOut2" result="blurOut3"/><feBlend in="SourceGraphic" in2="blurOut3" mode="normal"/></filter></defs><g><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="31" x2="31" y1="38.7999" y2="72.7999"/><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="84" x2="84" y1="38.7999" y2="72.7999"/><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="23.9999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="92.7999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="23.9999">bob</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="92.7999">bob</text><polygon fill="#A80036" points="72.5,50.7999,82.5,54.7999,72.5,58.7999,76.5,54.7999" style="stroke: #A80036; stroke-width: 1.0;"/><line style="stroke: #A80036; stroke-width: 1.0;" x1="31" x2="78.5" y1="54.7999" y2="54.7999"/>`)
    })
    it('should inline svg image with kroki-fetch-diagram', () => {
      const input = `
plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=inline]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" contentScriptType="application/ecmascript" contentStyleType="text/css" height="113px" preserveAspectRatio="none" style="width:112px;height:113px;" version="1.1" viewBox="0 0 112 113" width="112px" zoomAndPan="magnify"><defs><filter height="300%" id="f1keim8oeuimdl" width="300%" x="-1" y="-1"><feGaussianBlur result="blurOut" stdDeviation="2.0"/><feColorMatrix in="blurOut" result="blurOut2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/><feOffset dx="4.0" dy="4.0" in="blurOut2" result="blurOut3"/><feBlend in="SourceGraphic" in2="blurOut3" mode="normal"/></filter></defs><g><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="31" x2="31" y1="38.7999" y2="72.7999"/><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="84" x2="84" y1="38.7999" y2="72.7999"/><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="23.9999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="92.7999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="23.9999">bob</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="92.7999">bob</text><polygon fill="#A80036" points="72.5,50.7999,82.5,54.7999,72.5,58.7999,76.5,54.7999" style="stroke: #A80036; stroke-width: 1.0;"/><line style="stroke: #A80036; stroke-width: 1.0;" x1="31" x2="78.5" y1="54.7999" y2="54.7999"/>`)
    })
  })
})
