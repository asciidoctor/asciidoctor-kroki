import assert from 'node:assert'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import asciidoctorKroki from '../src/asciidoctor-kroki.js'

describe('Block attributes', { timeout: 30000 }, () => {
  describe('When extension is registered', () => {
    test('sets width and height attributes on the img element', async () => {
      const input = `
[plantuml,alice-bob,svg,width=100%,height=100%]
....
alice -> bob
....
`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const html = await convert(input, { extension_registry: registry })
      assert.strictEqual(
        html,
        `<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice-bob" width="100%" height="100%">
</div>
</div>`,
      )
    })
    test('renders the block title as a numbered figure caption', async () => {
      const input = `
.alice and bob
[plantuml,alice-bob,svg]
....
alice -> bob
....
`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const html = await convert(input, { extension_registry: registry })
      assert.strictEqual(
        html,
        `<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice and bob">
</div>
<div class="title">Figure 1. alice and bob</div>
</div>`,
      )
    })
    test('uses a custom caption attribute as the figure caption prefix', async () => {
      const input = `
.alice and bob
[plantuml,alice-bob,svg,caption="Figure A. "]
....
alice -> bob
....
`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const html = await convert(input, { extension_registry: registry })
      assert.strictEqual(
        html,
        `<div class="imageblock kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice and bob">
</div>
<div class="title">Figure A. alice and bob</div>
</div>`,
      )
    })
    test('adds the float direction as a CSS class on the imageblock wrapper', async () => {
      const input = `
[plantuml,alice-bob,svg,float=left]
....
alice -> bob
....
`
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const html = await convert(input, { extension_registry: registry })
      assert.strictEqual(
        html,
        `<div class="imageblock left kroki">
<div class="content">
<img src="https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=" alt="alice-bob">
</div>
</div>`,
      )
    })
    test('assigns sequential figure numbers to multiple titled diagrams', async () => {
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
      const registry = Extensions.create()
      asciidoctorKroki.register(registry)
      const html = await convert(input, { extension_registry: registry })
      assert.strictEqual(
        html,
        `<div class="imageblock kroki">
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
</div>`,
      )
    })
  })
})
