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
    expect(registry['$registered_for_block_macro?']('vega')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('vegalite')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('packetdiag')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('rackdiag')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('wavedrom')).to.be.an('object')
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
    it('should embed an SVG image with built-in allow-uri-read and data-uri (available in Asciidoctor.js 2+)', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'data-uri': true, 'allow-uri-read': true } })
      expect(html).to.contain('<img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBjb250ZW50U2NyaXB0VHlwZT0iYXBwbGljYXRpb24vZWNtYXNjcmlwdCIgY29udGVudFN0eWxlVHlwZT0idGV4dC9jc3MiIGhlaWdodD0iMTEzcHgiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiIHN0eWxlPSJ3aWR0aDoxMTJweDtoZWlnaHQ6MTEzcHg7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxMTIgMTEzIiB3aWR0aD0iMTEycHgiIHpvb21BbmRQYW49Im1hZ25pZnkiPjxkZWZzPjxmaWx0ZXIgaGVpZ2h0PSIzMDAlIiBpZD0iZjFrZWltOG9ldWltZGwiIHdpZHRoPSIzMDAlIiB4PSItMSIgeT0iLTEiPjxmZUdhdXNzaWFuQmx1ciByZXN1bHQ9ImJsdXJPdXQiIHN0ZERldmlhdGlvbj0iMi4wIi8+PGZlQ29sb3JNYXRyaXggaW49ImJsdXJPdXQiIHJlc3VsdD0iYmx1ck91dDIiIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAuNCAwIi8+PGZlT2Zmc2V0IGR4PSI0LjAiIGR5PSI0LjAiIGluPSJibHVyT3V0MiIgcmVzdWx0PSJibHVyT3V0MyIvPjxmZUJsZW5kIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImJsdXJPdXQzIiBtb2RlPSJub3JtYWwiLz48L2ZpbHRlcj48L2RlZnM+PGc+PGxpbmUgc3R5bGU9InN0cm9rZTogI0E4MDAzNjsgc3Ryb2tlLXdpZHRoOiAxLjA7IHN0cm9rZS1kYXNoYXJyYXk6IDUuMCw1LjA7IiB4MT0iMzEiIHgyPSIzMSIgeTE9IjM4Ljc5OTkiIHkyPSI3Mi43OTk5Ii8+PGxpbmUgc3R5bGU9InN0cm9rZTogI0E4MDAzNjsgc3Ryb2tlLXdpZHRoOiAxLjA7IHN0cm9rZS1kYXNoYXJyYXk6IDUuMCw1LjA7IiB4MT0iODQiIHgyPSI4NCIgeTE9IjM4Ljc5OTkiIHkyPSI3Mi43OTk5Ii8+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSI0MiIgeD0iOCIgeT0iMyIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjI4IiB4PSIxNSIgeT0iMjMuOTk5OSI+YWxpY2U8L3RleHQ+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSI0MiIgeD0iOCIgeT0iNzEuNzk5OSIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjI4IiB4PSIxNSIgeT0iOTIuNzk5OSI+YWxpY2U8L3RleHQ+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSIzNyIgeD0iNjQiIHk9IjMiLz48dGV4dCBmaWxsPSIjMDAwMDAwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgbGVuZ3RoQWRqdXN0PSJzcGFjaW5nQW5kR2x5cGhzIiB0ZXh0TGVuZ3RoPSIyMyIgeD0iNzEiIHk9IjIzLjk5OTkiPmJvYjwvdGV4dD48cmVjdCBmaWxsPSIjRkVGRUNFIiBmaWx0ZXI9InVybCgjZjFrZWltOG9ldWltZGwpIiBoZWlnaHQ9IjMwLjc5OTkiIHN0eWxlPSJzdHJva2U6ICNBODAwMzY7IHN0cm9rZS13aWR0aDogMS41OyIgd2lkdGg9IjM3IiB4PSI2NCIgeT0iNzEuNzk5OSIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjIzIiB4PSI3MSIgeT0iOTIuNzk5OSI+Ym9iPC90ZXh0Pjxwb2x5Z29uIGZpbGw9IiNBODAwMzYiIHBvaW50cz0iNzIuNSw1MC43OTk5LDgyLjUsNTQuNzk5OSw3Mi41LDU4Ljc5OTksNzYuNSw1NC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuMDsiLz48bGluZSBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuMDsiIHgxPSIzMSIgeDI9Ijc4LjUiIHkxPSI1NC43OTk5IiB5Mj0iNTQuNzk5OSIvPjwhLS1NRDU9Wzc5MDNkNmE3YjNhNjgyZjFlYmNlNzg1MGI1Yzk0ZmZlXQpAc3RhcnR1bWwNCmFsaWNlIC0+IGJvYg0KQGVuZHVtbA0KClBsYW50VU1MIHZlcnNpb24gMS4yMDIwLjA0KFRodSBNYXIgMTkgMTA6MTY6NDkgR01UIDIwMjApCihHUEwgc291cmNlIGRpc3RyaWJ1dGlvbikKSmF2YSBSdW50aW1lOiBPcGVuSkRLIFJ1bnRpbWUgRW52aXJvbm1lbnQKSlZNOiBPcGVuSkRLIDY0LUJpdCBTZXJ2ZXIgVk0KSmF2YSBWZXJzaW9uOiAxLjguMF8xOTEtYjEyCk9wZXJhdGluZyBTeXN0ZW06IExpbnV4CkRlZmF1bHQgRW5jb2Rpbmc6IFVURi04Ckxhbmd1YWdlOiBlbgpDb3VudHJ5OiBVUwotLT48L2c+PC9zdmc+" alt="diagram">')
    })
    it('should inline an SVG image with built-in allow-uri-read (available in Asciidoctor.js 2+)', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=inline]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'allow-uri-read': true } })
      expect(html).to.contain('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" contentScriptType="application/ecmascript" contentStyleType="text/css" height="113px" preserveAspectRatio="none" style="width:112px;height:113px;" version="1.1" viewBox="0 0 112 113" width="112px" zoomAndPan="magnify"><defs><filter height="300%" id="f1keim8oeuimdl" width="300%" x="-1" y="-1"><feGaussianBlur result="blurOut" stdDeviation="2.0"/><feColorMatrix in="blurOut" result="blurOut2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/><feOffset dx="4.0" dy="4.0" in="blurOut2" result="blurOut3"/><feBlend in="SourceGraphic" in2="blurOut3" mode="normal"/></filter></defs><g><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="31" x2="31" y1="38.7999" y2="72.7999"/><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="84" x2="84" y1="38.7999" y2="72.7999"/><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="23.9999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="92.7999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="23.9999">bob</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="92.7999">bob</text><polygon fill="#A80036" points="72.5,50.7999,82.5,54.7999,72.5,58.7999,76.5,54.7999" style="stroke: #A80036; stroke-width: 1.0;"/><line style="stroke: #A80036; stroke-width: 1.0;" x1="31" x2="78.5" y1="54.7999" y2="54.7999"/>')
    })
    it('should inline an SVG image with kroki-fetch-diagram', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=inline]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" contentScriptType="application/ecmascript" contentStyleType="text/css" height="113px" preserveAspectRatio="none" style="width:112px;height:113px;" version="1.1" viewBox="0 0 112 113" width="112px" zoomAndPan="magnify"><defs><filter height="300%" id="f1keim8oeuimdl" width="300%" x="-1" y="-1"><feGaussianBlur result="blurOut" stdDeviation="2.0"/><feColorMatrix in="blurOut" result="blurOut2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/><feOffset dx="4.0" dy="4.0" in="blurOut2" result="blurOut3"/><feBlend in="SourceGraphic" in2="blurOut3" mode="normal"/></filter></defs><g><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="31" x2="31" y1="38.7999" y2="72.7999"/><line style="stroke: #A80036; stroke-width: 1.0; stroke-dasharray: 5.0,5.0;" x1="84" x2="84" y1="38.7999" y2="72.7999"/><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="23.9999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="42" x="8" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="28" x="15" y="92.7999">alice</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="3"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="23.9999">bob</text><rect fill="#FEFECE" filter="url(#f1keim8oeuimdl)" height="30.7999" style="stroke: #A80036; stroke-width: 1.5;" width="37" x="64" y="71.7999"/><text fill="#000000" font-family="sans-serif" font-size="14" lengthAdjust="spacingAndGlyphs" textLength="23" x="71" y="92.7999">bob</text><polygon fill="#A80036" points="72.5,50.7999,82.5,54.7999,72.5,58.7999,76.5,54.7999" style="stroke: #A80036; stroke-width: 1.0;"/><line style="stroke: #A80036; stroke-width: 1.0;" x1="31" x2="78.5" y1="54.7999" y2="54.7999"/>')
    })
    it('should include an interactive SVG image with built-in allow-uri-read and data-uri (available in Asciidoctor.js 2+)', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=interactive]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'data-uri': true, 'allow-uri-read': true } })
      expect(html).to.contain('<object type="image/svg+xml" data="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBjb250ZW50U2NyaXB0VHlwZT0iYXBwbGljYXRpb24vZWNtYXNjcmlwdCIgY29udGVudFN0eWxlVHlwZT0idGV4dC9jc3MiIGhlaWdodD0iMTEzcHgiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiIHN0eWxlPSJ3aWR0aDoxMTJweDtoZWlnaHQ6MTEzcHg7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxMTIgMTEzIiB3aWR0aD0iMTEycHgiIHpvb21BbmRQYW49Im1hZ25pZnkiPjxkZWZzPjxmaWx0ZXIgaGVpZ2h0PSIzMDAlIiBpZD0iZjFrZWltOG9ldWltZGwiIHdpZHRoPSIzMDAlIiB4PSItMSIgeT0iLTEiPjxmZUdhdXNzaWFuQmx1ciByZXN1bHQ9ImJsdXJPdXQiIHN0ZERldmlhdGlvbj0iMi4wIi8+PGZlQ29sb3JNYXRyaXggaW49ImJsdXJPdXQiIHJlc3VsdD0iYmx1ck91dDIiIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAuNCAwIi8+PGZlT2Zmc2V0IGR4PSI0LjAiIGR5PSI0LjAiIGluPSJibHVyT3V0MiIgcmVzdWx0PSJibHVyT3V0MyIvPjxmZUJsZW5kIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImJsdXJPdXQzIiBtb2RlPSJub3JtYWwiLz48L2ZpbHRlcj48L2RlZnM+PGc+PGxpbmUgc3R5bGU9InN0cm9rZTogI0E4MDAzNjsgc3Ryb2tlLXdpZHRoOiAxLjA7IHN0cm9rZS1kYXNoYXJyYXk6IDUuMCw1LjA7IiB4MT0iMzEiIHgyPSIzMSIgeTE9IjM4Ljc5OTkiIHkyPSI3Mi43OTk5Ii8+PGxpbmUgc3R5bGU9InN0cm9rZTogI0E4MDAzNjsgc3Ryb2tlLXdpZHRoOiAxLjA7IHN0cm9rZS1kYXNoYXJyYXk6IDUuMCw1LjA7IiB4MT0iODQiIHgyPSI4NCIgeTE9IjM4Ljc5OTkiIHkyPSI3Mi43OTk5Ii8+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSI0MiIgeD0iOCIgeT0iMyIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjI4IiB4PSIxNSIgeT0iMjMuOTk5OSI+YWxpY2U8L3RleHQ+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSI0MiIgeD0iOCIgeT0iNzEuNzk5OSIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjI4IiB4PSIxNSIgeT0iOTIuNzk5OSI+YWxpY2U8L3RleHQ+PHJlY3QgZmlsbD0iI0ZFRkVDRSIgZmlsdGVyPSJ1cmwoI2Yxa2VpbThvZXVpbWRsKSIgaGVpZ2h0PSIzMC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuNTsiIHdpZHRoPSIzNyIgeD0iNjQiIHk9IjMiLz48dGV4dCBmaWxsPSIjMDAwMDAwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgbGVuZ3RoQWRqdXN0PSJzcGFjaW5nQW5kR2x5cGhzIiB0ZXh0TGVuZ3RoPSIyMyIgeD0iNzEiIHk9IjIzLjk5OTkiPmJvYjwvdGV4dD48cmVjdCBmaWxsPSIjRkVGRUNFIiBmaWx0ZXI9InVybCgjZjFrZWltOG9ldWltZGwpIiBoZWlnaHQ9IjMwLjc5OTkiIHN0eWxlPSJzdHJva2U6ICNBODAwMzY7IHN0cm9rZS13aWR0aDogMS41OyIgd2lkdGg9IjM3IiB4PSI2NCIgeT0iNzEuNzk5OSIvPjx0ZXh0IGZpbGw9IiMwMDAwMDAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiIHRleHRMZW5ndGg9IjIzIiB4PSI3MSIgeT0iOTIuNzk5OSI+Ym9iPC90ZXh0Pjxwb2x5Z29uIGZpbGw9IiNBODAwMzYiIHBvaW50cz0iNzIuNSw1MC43OTk5LDgyLjUsNTQuNzk5OSw3Mi41LDU4Ljc5OTksNzYuNSw1NC43OTk5IiBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuMDsiLz48bGluZSBzdHlsZT0ic3Ryb2tlOiAjQTgwMDM2OyBzdHJva2Utd2lkdGg6IDEuMDsiIHgxPSIzMSIgeDI9Ijc4LjUiIHkxPSI1NC43OTk5IiB5Mj0iNTQuNzk5OSIvPjwhLS1NRDU9Wzc5MDNkNmE3YjNhNjgyZjFlYmNlNzg1MGI1Yzk0ZmZlXQpAc3RhcnR1bWwNCmFsaWNlIC0+IGJvYg0KQGVuZHVtbA0KClBsYW50VU1MIHZlcnNpb24gMS4yMDIwLjA0KFRodSBNYXIgMTkgMTA6MTY6NDkgR01UIDIwMjApCihHUEwgc291cmNlIGRpc3RyaWJ1dGlvbikKSmF2YSBSdW50aW1lOiBPcGVuSkRLIFJ1bnRpbWUgRW52aXJvbm1lbnQKSlZNOiBPcGVuSkRLIDY0LUJpdCBTZXJ2ZXIgVk0KSmF2YSBWZXJzaW9uOiAxLjguMF8xOTEtYjEyCk9wZXJhdGluZyBTeXN0ZW06IExpbnV4CkRlZmF1bHQgRW5jb2Rpbmc6IFVURi04Ckxhbmd1YWdlOiBlbgpDb3VudHJ5OiBVUwotLT48L2c+PC9zdmc+"><span class="alt">diagram</span></object>')
    })
    it('should include an interactive SVG image with kroki-fetch-diagram', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[svg,role=sequence,opts=interactive]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { safe: 'safe', extension_registry: registry, attributes: { 'kroki-fetch-diagram': true } })
      expect(html).to.contain('<object type="image/svg+xml" data=".asciidoctor/kroki/3b6025d05a9642fd93791b9eed064448bee17803.svg"><span class="alt">diagram</span></object>')
    })
    it('should convert a PacketDiag diagram to an image', () => {
      const input = `
[packetdiag]
....
packetdiag {
  colwidth = 32;
  node_height = 72;

  0-15: Source Port;
  16-31: Destination Port;
  32-63: Sequence Number;
  64-95: Acknowledgment Number;
  96-99: Data Offset;
  100-105: Reserved;
  106: URG [rotate = 270];
  107: ACK [rotate = 270];
  108: PSH [rotate = 270];
  109: RST [rotate = 270];
  110: SYN [rotate = 270];
  111: FIN [rotate = 270];
  112-127: Window;
  128-143: Checksum;
  144-159: Urgent Pointer;
  160-191: (Options and Padding);
  192-223: data [colheight = 3];
}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/packetdiag/svg/eNptkU9Pg0AQxe9-ijnqYRN2QSgYD6bGPzFpCW1jTGPMyk5hQ9mtsMjB-N0dIGk8cH2_mXkzb04yr9ApLQv4uQDI7bHXypVwC764IcFYhR8l6qJ0pEWkkegxfp3AxnZNjpDaxg2VPGQ-T-AeW6eNdNqaM_IFC31qwK8ODbWsuvoTm4GEAYtp1F1eGdsfURU1GvePxyGLYxoqnYT14dDiZOXRBh71Zdhi841qEsMEdtkj7BvrpENaV0Te-4Qi8li-zKJFAunmaRaRc7bZziHu0Tlvq1lEITw8zyPBuKBVXrVRth8lsWA8oGyWJeZV29WjGAQUMJnvmmKII7XauCkPHtLlMTlcrk9DxC1IoyCVSmlTXI0VsWBC0EQ1ZLanh56_59MWv39OCoi9')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a RackDiag diagram to an image', () => {
      const input = `
[rackdiag]
....
rackdiag {
  16U;
  1: UPS [2U];
  3: DB Server;
  4: Web Server;
  5: Web Server;
  6: Web Server;
  7: Load Balancer;
  8: L3 Switch;
}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/rackdiag/svg/eNorSkzOTslMTFeo5lJQMDQLtQZRVgqhAcEK0UahsSCusZWCi5NCcGpRWWoRiG9ipRCemoQkYIouYIYuYG6l4JOfmKLglJiTmJcMEbMAihkrBJdnliRnWHPVAgDhXSWB')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Vega diagram to an image', () => {
      const input = `
[vega]
....
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "width": 400,
  "height": 200,
  "padding": 5,

  "data": [
    {
      "name": "table",
      "values": [
        {"category": "A", "amount": 28},
        {"category": "B", "amount": 55},
        {"category": "C", "amount": 43},
        {"category": "D", "amount": 91},
        {"category": "E", "amount": 81},
        {"category": "F", "amount": 53},
        {"category": "G", "amount": 19},
        {"category": "H", "amount": 87}
      ]
    }
  ],

  "signals": [
    {
      "name": "tooltip",
      "value": {},
      "on": [
        {"events": "rect:mouseover", "update": "datum"},
        {"events": "rect:mouseout",  "update": "{}"}
      ]
    }
  ],

  "scales": [
    {
      "name": "xscale",
      "type": "band",
      "domain": {"data": "table", "field": "category"},
      "range": "width",
      "padding": 0.05,
      "round": true
    },
    {
      "name": "yscale",
      "domain": {"data": "table", "field": "amount"},
      "nice": true,
      "range": "height"
    }
  ],

  "axes": [
    { "orient": "bottom", "scale": "xscale" },
    { "orient": "left", "scale": "yscale" }
  ],

  "marks": [
    {
      "type": "rect",
      "from": {"data":"table"},
      "encode": {
        "enter": {
          "x": {"scale": "xscale", "field": "category"},
          "width": {"scale": "xscale", "band": 1},
          "y": {"scale": "yscale", "field": "amount"},
          "y2": {"scale": "yscale", "value": 0}
        },
        "update": {
          "fill": {"value": "steelblue"}
        },
        "hover": {
          "fill": {"value": "red"}
        }
      }
    },
    {
      "type": "text",
      "encode": {
        "enter": {
          "align": {"value": "center"},
          "baseline": {"value": "bottom"},
          "fill": {"value": "#333"}
        },
        "update": {
          "x": {"scale": "xscale", "signal": "tooltip.category", "band": 0.5},
          "y": {"scale": "yscale", "signal": "tooltip.amount", "offset": -2},
          "text": {"signal": "tooltip.amount"},
          "fillOpacity": [
            {"test": "datum === tooltip", "value": 0},
            {"value": 1}
          ]
        }
      }
    }
  ]
}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/vega/svg/eNqVVcmSmzAQvfsrKCVHgrE9VGZc5UP23PIBKR8ENKAZgSgQjikX_x5JLELYcpzLMDTv9fq6fVk5DnpfRxnkGO0dlHFe1vv1-gQp9lLCsyb0CFv3AGVdnwLvtWYFciX1D4l5JohPvq_eMyBpxoVhOxhKHMekSIUlcFfSEGMuI_0W_zvORf0V1gLnIONzHFJQrpX5hGkD9QRXFBRhDimrWon_hFwH4Zw1hQr63LkW4GcDGARW4BcD-LSzAr8awJeNFfjNAD7bgd_NHO2hfxjAzYsV-NMM_bEbcEf1lG_Hfio1SQtM6zuDYYxyUi5GI75cpuBIiMKcFJyg4NIpqiDie5FHDewElcyqKYUSlGvxbHJk1HCT2HDBmxMvHbIXFGEKd-o5K4Auh7elsoe4iLU1ZjkmsqrLqNtRoQ5KCNBYWqaG605UuEiVu34_JrveBt_zAw0XA5KueNVAX4h7O-t2kfVD-Q3z19kVJIIh2nXGwwYv-4nP826KWVcElKhQyDhnuYzYJ6ebO5Uxh1NIuAFuR7AOluPq7cbsxhlJTegeJJWIrjswNEBXC0XEYqXUSWDCxoUK5yZhPCsvyyLuT1oRxyN4k6wEJZbUpLQmvL2OtZxaT9vaeOM6-t2En1H10hgVJ4RS5XBko5oD0FC-3PaTqfX9p5sK4rmD1fy51PY4VQ7n2VQfnhqm4nSZ0aMeaLYuxDVQUoAJHcRrQq_rebfb7dD_dNaqpf7Qzi6qN4lKi8X3ggflcu1u0I34xpKkBrlzH7amN9Vp5dDGvu7HrxJHhLfGge9vNYeaT2fcORwOzvRbMZelu6CNXzbd7MPRphl5G1bdX_2bNmU=')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Vega-Lite diagram to an image', () => {
      const input = `
[vegalite]
....
{
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "description": "Horizontally concatenated charts that show different types of discretizing scales.",
  "data": {
    "values": [
      {"a": "A", "b": 28},
      {"a": "B", "b": 55},
      {"a": "C", "b": 43},
      {"a": "D", "b": 91},
      {"a": "E", "b": 81},
      {"a": "F", "b": 53},
      {"a": "G", "b": 19},
      {"a": "H", "b": 87},
      {"a": "I", "b": 52}
    ]
  },
  "hconcat": [
    {
      "mark": "circle",
      "encoding": {
        "y": {
          "field": "b",
          "type": "nominal",
          "sort": null,
          "axis": {
            "ticks": false,
            "domain": false,
            "title": null
          }
        },
        "size": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "quantize"
          }
        },
        "color": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "quantize",
            "zero": true
          },
          "legend": {
            "title": "Quantize"
          }
        }
      }
    },
    {
      "mark": "circle",
      "encoding": {
        "y": {
          "field": "b",
          "type": "nominal",
          "sort": null,
          "axis": {
            "ticks": false,
            "domain": false,
            "title": null
          }
        },
        "size": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "quantile",
            "range": [80, 160, 240, 320, 400]
          }
        },
        "color": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "quantile",
            "scheme": "magma"
          },
          "legend": {
            "format": "d",
            "title": "Quantile"
          }
        }
      }
    },
    {
      "mark": "circle",
      "encoding": {
        "y": {
          "field": "b",
          "type": "nominal",
          "sort": null,
          "axis": {
            "ticks": false,
            "domain": false,
            "title": null
          }
        },
        "size": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "threshold",
            "domain": [30, 70],
            "range": [80, 200, 320]
          }
        },
        "color": {
          "field": "b",
          "type": "quantitative",
          "scale": {
            "type": "threshold",
            "domain": [30, 70],
            "scheme": "viridis"
          },
          "legend": {
            "title": "Threshold"
          }
        }
      }
    }
  ],
  "resolve": {
    "scale": {
      "color": "independent",
      "size": "independent"
    }
  }
}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/vegalite/svg/eNrtVktz2yAQvvtXMEyOqt9pnNz6To-d6c3jA5ZWEg0CF7Ba26P_3gVb2JJSN8mhTWdyMIb92CffCnY9QuiFiXMoGL0hNLd2ZW4GgxIy1s-4zdfLPleD_QYvfSW4hUE57X8zStLI6SdgYs1XlqMAbdwqzbdKWibEhsRKxsyCxF9C4pxpa4jNmSUmVz9IwtMUNEhL7GYFhqgURWgMLN9ymRETMwGmf3DDrItxh3NclUysweB67teE7KjP4A2NCF3ibDyroib0toYuL9vQuxqaTtrQ-xq6HrWhDzU060Afg6-OwU81NLpuQ7fB4FUb-hwMjiuPLHD0m2i-L3Koxe6gSQum75xuzHUsgNYWKchYJVjfUE0v3TSWKEg5iMTpL4Oql7uzcmKpCi6ZaIJGaReJXAvRkLOf3LQcOFM8vnPilAkDURNLVMG4_A1ouRVw8HOCVGFeHRWo4Vt4bHLf10yiE2Z5Ca0MHSnvSaWhiA7_GFashNJ_P65WJbegFeJWr-E04oZpARnI5L7j258C_XI-6d7p_8H0C0v_PUtFhw2aycxtmM-GERm9xmE8xWEyxmE6HC6eJam7afgLy-8oWIZX26OZnSpd-E8qTWh0lvTihfT_C-ltrgHfHaJzpCGf-QR5fjVcnOuK8XDfEM-tF56c3bFZSq45PsDo0y-CryGIhzQFjj4YikpKlMfkOrmGWlIuE1hhEPhqPLbNgUYNMLioetUvacF4MA==')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a WaveDrom diagram to an image', () => {
      const input = `
[wavedrom]
....
{ signal: [
  { name: "clk",         wave: "p.....|..." },
  { name: "Data",        wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  { name: "Request",     wave: "0.1..0|1.0" },
  {},
  { name: "Acknowledge", wave: "1.....|01." }
]}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/wavedrom/svg/eNqrVijOTM9LzLFSiOZSUKhWyEvMTbVSUErOyVbSUYCB8sQykGCBHgjUALGSQq0OsnKXxJJEhHqo8go9YxPTihpbvQqgVApQBdAOpYzUxBQgVykpP6USRJckZuaAaJC8UiyasUGphaWpxSVQk6HGGugZ6ukZ1BjqGcBcgarJMTk7L788JzUlPRWoEarJEOJ0A0OQ07liawGPW0Gr')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
  })
})
