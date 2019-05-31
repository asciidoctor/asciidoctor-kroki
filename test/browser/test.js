/* global it, describe, mocha, chai, Asciidoctor, AsciidoctorKroki, mochaOpts */
const httpGet = (uri, encoding = 'utf8') => {
  let data = ''
  let status = -1
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', uri, false)
    if (encoding === 'binary') {
      xhr.responseType = 'arraybuffer'
    }
    xhr.addEventListener('load', function () {
      status = this.status
      if (status === 200 || status === 0) {
        if (encoding === 'binary') {
          const arrayBuffer = xhr.response
          const byteArray = new Uint8Array(arrayBuffer)
          for (let i = 0; i < byteArray.byteLength; i++) {
            data += String.fromCharCode(byteArray[i])
          }
        } else {
          data = this.responseText
        }
      }
    })
    xhr.send()
  } catch (e) {
    throw new Error(`Error reading file: ${uri}; reason: ${e.message}`)
  }
  // assume that no data means it doesn't exist
  if (status === 404 || !data) {
    throw new Error(`No such file: ${uri}`)
  }
  return data
}

(async () => {
  let reporter
  if (typeof mochaOpts === 'function') {
    reporter = await mochaOpts().reporter
  } else {
    reporter = 'html'
  }
  mocha.setup({
    ui: 'bdd',
    ignoreLeaks: true,
    reporter: reporter
  })

  const expect = chai.expect
  const asciidoctor = Asciidoctor({ runtime: { platform: 'browser' } })
  const parts = window.location.href.split('/') // break the string into an array
  parts.pop()
  parts.pop()
  parts.pop()
  const baseDir = parts.join('/')

  describe('Conversion', () => {
    describe('When extension is registered', () => {
      it('should convert a diagram to an image', () => {
        const input = `
[plantuml,alice-bob,svg,role=sequence]
....
alice -> bob
....
`
        const registry = asciidoctor.Extensions.create()
        AsciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, { extension_registry: registry })
        expect(html).to.contain('https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk8CABoDA90=')
        expect(html).to.contain('<div class="imageblock sequence kroki">')
      })
      it('should convert a diagram with a relative path to an image', () => {
        const input = `plantuml::${baseDir}/test/fixtures/alice.puml[svg,role=sequence]`
        const registry = asciidoctor.Extensions.create()
        AsciidoctorKroki.register(registry, {
          vfs: {
            read: (path, encoding = 'utf8') => {
              return httpGet(path, encoding)
            },
            exists: (_) => {
              return false
            },
            add: (_) => {
              // no-op
            }
          }
        })
        const html = asciidoctor.convert(input, { extension_registry: registry, safe: 'safe', attributes: { 'allow-uri-read': true } })
        expect(html).to.contain('<img src="https://kroki.io/plantuml/svg/eNpzKC5JLCopzc3hSszJTE5V0LVTSMpP4nJIzUsBCQIAr3EKfA==" alt="diagram">')
      })
    })
  })

  mocha.run(function (failures) {
    if (failures > 0) {
      console.error('%d failures', failures)
    }
  })
})().catch(err => {
  console.error('Unable to start the browser tests suite: ' + err)
})
