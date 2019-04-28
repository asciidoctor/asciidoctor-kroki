/* global describe it */
const chai = require('chai')
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
  describe('When extension is registered', () => {
    it('should convert a diagram to an image', () => {
      const input = `
[plantuml,svg,role=sequence]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=')
      expect(html).to.contain('<div class="imageblock sequence kroki">')
    })
    it('should convert a diagram with an absolute path to an image', () => {
      const input = `plantuml::${__dirname}/fixtures/alice.puml[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/plantuml/svg/eNpzKC5JLCopzc3hSszJTE5V0LVTSMpP4nJIzUsBCQIAr3EKfA==')
      expect(html).to.contain('<div class="imageblock sequence kroki">')
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
    })
    it('should not download twice the same image', () => {
    })
  })
})
