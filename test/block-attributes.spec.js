/* global describe it */
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import Asciidoctor from '@asciidoctor/core'

import asciidoctorKroki from '../src/asciidoctor-kroki.js'

chai.use(dirtyChai)
const expect = chai.expect
const asciidoctor = Asciidoctor()

describe('Block attributes', () => {
  describe('When extension is registered', () => {
    it('should convert a diagram with an explicit width and height', () => {
      const input = `
[plantuml,alice-bob,svg,width=100%,height=100%]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice-bob" width="100%" height="100%">
</div>
</div>`)
    })
    it('should convert a diagram with a title', () => {
      const input = `
.alice and bob
[plantuml,alice-bob,svg]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice and bob">
</div>
<div class="title">Figure 1. alice and bob</div>
</div>`)
    })
    it('should convert a diagram with a caption', () => {
      const input = `
.alice and bob
[plantuml,alice-bob,svg,caption="Figure A. "]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice and bob">
</div>
<div class="title">Figure A. alice and bob</div>
</div>`)
    })
    it('should convert a diagram with the float attribute', () => {
      const input = `
[plantuml,alice-bob,svg,float=left]
....
alice -> bob
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.equal(`<div class="imageblock left kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice-bob">
</div>
</div>`)
    })
    it('should automatically increment caption if diagrams has title and caption is enabled', () => {
      const input = `
.alice and bob
[plantuml,alice-bob,svg]
....
alice -> bob
....

.dan and andre
[plantuml,dan-andre,svg]
....
dan -> andre
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice and bob">
</div>
<div class="title">Figure 1. alice and bob</div>
</div>
<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLScxT0LVTSMxLKUoFABg_A-k=" alt="dan and andre">
</div>
<div class="title">Figure 2. dan and andre</div>
</div>`)
    })
  })
})
