/* global describe it before */
const ospath = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises
const rusha = require('rusha')
const pako = require('pako')
const path = require('path')
const chai = require('chai')
const sinon = require('sinon')
const rimraf = require('rimraf')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const { readFixture, fixturePath, deleteDirWithFiles } = require('./utils.js')
const http = require('../src/http/node-http.js')
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
    expect(registry['$registered_for_block_macro?']('excalidraw')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('pikchr')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('structurizr')).to.be.an('object')
    expect(registry['$registered_for_block_macro?']('diagramsnet')).to.be.an('object')
  })
})

describe('Conversion', () => {
  before(() => {
    rimraf.sync(ospath.join(__dirname, '..', '.asciidoctor', 'kroki', '*'))
  })

  function encode (file) {
    const text = fs.readFileSync(file, 'utf8')
    return encodeText(text)
  }

  function encodeText (text) {
    const data = Buffer.from(text, 'utf8')
    const compressed = pako.deflate(data, { level: 9 })
    return Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }

  function getDiagramFromHTML (html) {
    const diagrams = html.match(/(?<="https:\/\/kroki\.io\/plantuml\/svg\/)[^"]+/g)
    if (diagrams) {
      return pako.inflate(Buffer.from(diagrams[0], 'base64'), { to: 'string' })
    }
  }

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
    it('should only pass diagram options as query parameters', () => {
      const input = `
[plantuml,alice-bob,svg,role=sequence,width=100,format=svg,link=https://asciidoc.org/,align=center,float=right,theme=bluegray]
....
alice -> bob: hello
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/plantuml/svg/eNpLzMlMTlXQtVNIyk-yUshIzcnJBwA9iwZL?theme=bluegray')
      expect(html).to.contain('<div class="imageblock right text-center sequence kroki-format-svg kroki">')
    })
    it('should convert a diagram with an absolute path to an image', () => {
      const file = fixturePath('alice.puml')
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encode(file)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a PlantUML diagram and resolve include relative to base directory', () => {
      const file = fixturePath('plantuml', 'alice-with-styles.puml')
      const diagramText = fs.readFileSync(file, 'utf8')
        .replace(/^!include (.*)\r?\n/m, fs.readFileSync(fixturePath('plantuml', 'styles', 'general.iuml'), 'utf8') + '\n')
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        base_dir: fixturePath()
      })
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encodeText(diagramText)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a PlantUML diagram and resolve include relative to diagram directory', () => {
      const file = fixturePath('plantuml', 'hello.puml')
      const diagramText = fs.readFileSync(file, 'utf8')
        .replace(/^!include (.*)\r?\n/m, fs.readFileSync(fixturePath('plantuml', 'styles', 'general.iuml'), 'utf8') + '\n')
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        base_dir: fixturePath()
      })
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encodeText(diagramText)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a PlantUML diagram and resolve includes from configured kroki-plantuml-include-paths attribute with single path', () => {
      const file = fixturePath('plantuml', 'diagrams', 'hello-with-style.puml')
      const diagramText = fs.readFileSync(file, 'utf8')
        .replace(/^!include (.*)\r?\n/m,
          fs.readFileSync(fixturePath('plantuml', 'styles', 'general.iuml'), 'utf8') + '\n' +
          fs.readFileSync(fixturePath('plantuml', 'styles', 'note.iuml'), 'utf8') + '\n' +
          fs.readFileSync(fixturePath('plantuml', 'styles', 'sequence.iuml'), 'utf8') + '\n'
        )
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-plantuml-include-paths': fixturePath('plantuml', 'styles') },
        base_dir: fixturePath()
      })
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encodeText(diagramText)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a PlantUML diagram and resolve includes from configured kroki-plantuml-include-paths attribute with multiple paths', () => {
      const file = fixturePath('plantuml', 'diagrams', 'hello-with-base-and-note.puml')
      const diagramText = fs.readFileSync(file, 'utf8')
        .replace(/^!include base.iuml\r?\n/m, fs.readFileSync(fixturePath('plantuml', 'include', 'base.iuml'), 'utf8') + '\n')
        .replace(/^!include note.iuml\r?\n/m, fs.readFileSync(fixturePath('plantuml', 'styles', 'note.iuml'), 'utf8') + '\n')
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-plantuml-include-paths': fixturePath('plantuml', 'styles') + path.delimiter + fixturePath('plantuml', 'include') },
        base_dir: fixturePath()
      })
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encodeText(diagramText)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a diagram with a relative path to an image', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

plantuml::test/fixtures/alice.puml[png,role=sequence]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true }
      })
      const file = fixturePath('alice.puml')
      const hash = rusha.createHash().update(`https://kroki.io/plantuml/png/${encode(file)}`).digest('hex')
      expect(html).to.contain(`<img src=".asciidoctor/kroki/diag-${hash}.png" alt="Diagram">`)
    }).timeout(5000)
    it('should include the plantuml-config at the top of the diagram', () => {
      const file = fixturePath('alice.puml')
      const config = fixturePath('plantuml', 'include', 'base.iuml')
      const input = `plantuml::${file}[svg,role=sequence]`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-plantuml-include': config }
      })
      const diagramText = getDiagramFromHTML(html)
      expect(diagramText).to.contain('skinparam BackgroundColor black')
      expect(diagramText).to.contain('alice -> bob')
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    }).timeout(5000)
    it('should convert a file containing the macro form using a relative path to a diagram', () => {
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const macroFile = fixturePath('alice.puml')
      const html = asciidoctor.loadFile(fixturePath('macro', 'doc.adoc'), { extension_registry: registry, safe: 'unsafe' }).convert()
      expect(html).to.contain(`https://kroki.io/plantuml/svg/${encode(macroFile)}`)
      expect(html).to.contain('<div class="imageblock sequence kroki-format-svg kroki">')
    })
    it('should create diagrams in imagesdir if kroki-fetch-diagram is set', async () => {
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const doc = asciidoctor.convertFile(fixturePath('fetch', 'doc.adoc'), { extension_registry: registry, safe: 'unsafe' })
      fs.unlinkSync(doc.getAttributes().outfile)
      const imageLocation = path.join(doc.base_dir, doc.getAttributes().imagesdir)
      try {
        const files = await fsPromises.readdir(imageLocation)
        expect(files).to.have.lengthOf(1)
      } finally {
        deleteDirWithFiles(imageLocation)
      }
    })
    it('should not fetch diagram (and write to disk) when safe mode is secure', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

[plantuml,hello-world,svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'secure', // default value
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true }
      })
      expect(html).to.contain('<img src="https://kroki.io/plantuml/svg/eNrzSM3JyVfQtVMIzy_KSQEAIiQEqA==" alt="hello-world">')
    }).timeout(5000)
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
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true }
      })
      expect(html).to.contain('<img src=".asciidoctor/kroki/hello-world-7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="hello-world">')
    }).timeout(5000)
    it('should download and save an image to a local folder using a generated unique name (md5sum)', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

[plantuml,"",svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true }
      })
      expect(html).to.contain('<img src=".asciidoctor/kroki/diag-7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="Diagram">')
    }).timeout(5000)
    it('should download and save an image to the images output directory (imagesoutdir attribute and imagesdir)', () => {
      const input = `
[plantuml,"",svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true, imagesoutdir: '.asciidoctor/kroki/images', imagesdir: '../images' },
        to_dir: '.asciidoctor/kroki/relative',
        to_file: 'relative.html',
        standalone: false,
        mkdirs: true
      })
      const html = fs.readFileSync(ospath.join(__dirname, '..', '.asciidoctor', 'kroki', 'relative', 'relative.html'), 'utf8')
      expect(html).to.contain('<img src="../images/diag-7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="Diagram">')
    }).timeout(5000)
    it('should download and save an image to the output directory (to_dir option)', () => {
      const input = `
[plantuml,"",svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true },
        to_dir: '.asciidoctor/kroki/to_dir',
        to_file: 'to-dir-option.html',
        standalone: false,
        mkdirs: true
      })
      const html = fs.readFileSync(ospath.join(__dirname, '..', '.asciidoctor', 'kroki', 'to_dir', 'to-dir-option.html'), 'utf8')
      expect(html).to.contain('<img src="diag-7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="Diagram">')
    }).timeout(5000)
    it('should download and save an image relative to the output directory (to_dir option and imagedir attribute)', () => {
      const input = `
[plantuml,"",svg,role=sequence]
....
Hello -> World
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true, imagesdir: 'img' },
        to_dir: '.asciidoctor/kroki/to_dir',
        to_file: 'to-dir-option-with-imagedir-attr.html',
        standalone: false,
        mkdirs: true
      })
      const html = fs.readFileSync(ospath.join(__dirname, '..', '.asciidoctor', 'kroki', 'to_dir', 'to-dir-option-with-imagedir-attr.html'), 'utf8')
      expect(html).to.contain('<img src="img/diag-7a123c0b2909750ca5526554cd8620774ccf6cd9.svg" alt="Diagram">')
    }).timeout(5000)
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
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'kroki-fetch-diagram': true }
      })
      const file = fixturePath('alice.puml')
      const hash = rusha.createHash().update(`https://kroki.io/plantuml/svg/${encode(file)}`).digest('hex')
      expect(html).to.contain(`<img src=".asciidoctor/kroki/diag-${hash}.svg" alt="Diagram">`)
    })
    it('should not download twice the same image with generated name', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

[plantuml,"",svg,role=sequence]
....
AsciiDoc -> HTML5: convert
....
`
      sinon.spy(http, 'get')
      try {
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, {
          safe: 'safe',
          extension_registry: registry,
          attributes: { 'kroki-fetch-diagram': true }
        })
        expect(html).to.contain('<img src=".asciidoctor/kroki/diag-ea85be88a0e4e5fb02f59602af7fe207feb5b904.svg" alt="Diagram">')
        expect(http.get.calledOnce).to.be.true()
      } finally {
        http.get.restore()
      }
    }).timeout(5000)
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
    it('should embed an SVG image with built-in allow-uri-read and data-uri (available in Asciidoctor.js 2+)', () => {
      const input = `
:imagesdir: .asciidoctor/kroki

vegalite::test/fixtures/chart.vlite[svg,role=chart]
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry,
        attributes: { 'data-uri': true, 'allow-uri-read': true }
      })
      expect(html).to.contain('<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz')
    }).timeout(5000)
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
    it('should inline a referenced data file for a Vega-Lite diagram and convert to an image', () => {
      const input = `
[vegalite]
....
{
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "data": {
    "url": "test/fixtures/vegalite-data.csv"
  },
  "encoding": {
    "color": {
      "field": "c",
      "type": "nominal"
    },
    "x": {
      "field": "a",
      "type": "temporal"
    },
    "y": {
      "field": "b",
      "type": "quantitative"
    }
  },
  "mark": "line"
}
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, {
        safe: 'safe',
        extension_registry: registry
      })
      const values = readFixture('vegalite-data.csv')
      const text = JSON.stringify({
        $schema: 'https://vega.github.io/schema/vega-lite/v4.json',
        data: {
          values,
          format: {
            type: 'csv'
          }
        },
        encoding: {
          color: {
            field: 'c',
            type: 'nominal'
          },
          x: {
            field: 'a',
            type: 'temporal'
          },
          y: {
            field: 'b',
            type: 'quantitative'
          }
        },
        mark: 'line'
      })
      expect(html).to.contain(`https://kroki.io/vegalite/svg/${encodeText(text)}`)
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
    it('should convert a BPMN diagram to an image', () => {
      const input = `
[bpmn]
....
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             expressionLanguage="http://www.w3.org/1999/XPath"
             typeLanguage="http://www.w3.org/2001/XMLSchema"
             targetNamespace=""
             xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL http://www.omg.org/spec/BPMN/2.0/20100501/BPMN20.xsd">
<collaboration id="sid-c0e745ff-361e-4afb-8c8d-2a1fc32b1424">
    <participant id="sid-87F4C1D6-25E1-4A45-9DA7-AD945993D06F" name="Customer" processRef="sid-C3803939-0872-457F-8336-EAE484DC4A04">
    </participant>
</collaboration>
<process id="sid-C3803939-0872-457F-8336-EAE484DC4A04" isClosed="false" isExecutable="false" name="Customer" processType="None">
    <extensionElements/>
    <laneSet id="sid-b167d0d7-e761-4636-9200-76b7f0e8e83a">
        <lane id="sid-57E4FE0D-18E4-478D-BC5D-B15164E93254">
            <flowNodeRef>START_PROCESS</flowNodeRef>
            <flowNodeRef>SCAN_QR_CODE</flowNodeRef>
            <flowNodeRef>SCAN_OK</flowNodeRef>
            <flowNodeRef>sid-E49425CF-8287-4798-B622-D2A7D78EF00B</flowNodeRef>
            <flowNodeRef>END_PROCESS</flowNodeRef>
            <flowNodeRef>sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9</flowNodeRef>
        </lane>
    </laneSet>
    <startEvent id="START_PROCESS" name="Notices&#10;QR code">
        <outgoing>sid-7B791A11-2F2E-4D80-AFB3-91A02CF2B4FD</outgoing>
    </startEvent>
    <task completionQuantity="1" id="SCAN_QR_CODE" isForCompensation="false" name="Scan QR code" startQuantity="1">
        <incoming>sid-4DC479E5-5C20-4948-BCFC-9EC5E2F66D8D</incoming>
        <outgoing>sid-EE8A7BA0-5D66-4F8B-80E3-CC2751B3856A</outgoing>
    </task>
    <exclusiveGateway gatewayDirection="Diverging" id="SCAN_OK" name="Scan successful?&#10;">
        <incoming>sid-EE8A7BA0-5D66-4F8B-80E3-CC2751B3856A</incoming>
        <outgoing>sid-8B820AF5-DC5C-4618-B854-E08B71FB55CB</outgoing>
        <outgoing>sid-337A23B9-A923-4CCE-B613-3E247B773CCE</outgoing>
    </exclusiveGateway>
    <task completionQuantity="1" id="sid-E49425CF-8287-4798-B622-D2A7D78EF00B" isForCompensation="false" name="Open product information in mobile  app" startQuantity="1">
        <incoming>sid-8B820AF5-DC5C-4618-B854-E08B71FB55CB</incoming>
        <outgoing>sid-57EB1F24-BD94-479A-BF1F-57F1EAA19C6C</outgoing>
    </task>
    <endEvent id="END_PROCESS" name="Is informed">
        <incoming>sid-57EB1F24-BD94-479A-BF1F-57F1EAA19C6C</incoming>
    </endEvent>
    <exclusiveGateway gatewayDirection="Converging" id="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9">
        <incoming>sid-7B791A11-2F2E-4D80-AFB3-91A02CF2B4FD</incoming>
        <incoming>sid-337A23B9-A923-4CCE-B613-3E247B773CCE</incoming>
        <outgoing>sid-4DC479E5-5C20-4948-BCFC-9EC5E2F66D8D</outgoing>
    </exclusiveGateway>
    <sequenceFlow id="sid-7B791A11-2F2E-4D80-AFB3-91A02CF2B4FD" sourceRef="START_PROCESS" targetRef="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9"/>
    <sequenceFlow id="sid-EE8A7BA0-5D66-4F8B-80E3-CC2751B3856A" sourceRef="SCAN_QR_CODE" targetRef="SCAN_OK"/>
    <sequenceFlow id="sid-57EB1F24-BD94-479A-BF1F-57F1EAA19C6C" sourceRef="sid-E49425CF-8287-4798-B622-D2A7D78EF00B" targetRef="END_PROCESS"/>
    <sequenceFlow id="sid-8B820AF5-DC5C-4618-B854-E08B71FB55CB" name="No" sourceRef="SCAN_OK" targetRef="sid-E49425CF-8287-4798-B622-D2A7D78EF00B"/>
    <sequenceFlow id="sid-4DC479E5-5C20-4948-BCFC-9EC5E2F66D8D" sourceRef="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9" targetRef="SCAN_QR_CODE"/>
    <sequenceFlow id="sid-337A23B9-A923-4CCE-B613-3E247B773CCE" name="Yes" sourceRef="SCAN_OK" targetRef="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9"/>
</process>
<bpmndi:BPMNDiagram id="sid-74620812-92c4-44e5-949c-aa47393d3830">
    <bpmndi:BPMNPlane bpmnElement="sid-c0e745ff-361e-4afb-8c8d-2a1fc32b1424" id="sid-cdcae759-2af7-4a6d-bd02-53f3352a731d">
        <bpmndi:BPMNShape bpmnElement="sid-87F4C1D6-25E1-4A45-9DA7-AD945993D06F" id="sid-87F4C1D6-25E1-4A45-9DA7-AD945993D06F_gui" isHorizontal="true">
            <omgdc:Bounds height="250.0" width="933.0" x="42.5" y="75.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-84cb49fd-2f7c-44fb-8950-83c3fa153d3b">
                <omgdc:Bounds height="59.142852783203125" width="12.000000000000014" x="47.49999999999999" y="170.42857360839844"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="sid-57E4FE0D-18E4-478D-BC5D-B15164E93254" id="sid-57E4FE0D-18E4-478D-BC5D-B15164E93254_gui" isHorizontal="true">
            <omgdc:Bounds height="250.0" width="903.0" x="72.5" y="75.0"/>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="START_PROCESS" id="START_PROCESS_gui">
            <omgdc:Bounds height="30.0" width="30.0" x="150.0" y="165.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
                <omgdc:Bounds height="22.0" width="46.35714340209961" x="141.8214282989502" y="197.0"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="SCAN_QR_CODE" id="SCAN_QR_CODE_gui">
            <omgdc:Bounds height="80.0" width="100.0" x="352.5" y="140.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-84cb49fd-2f7c-44fb-8950-83c3fa153d3b">
                <omgdc:Bounds height="12.0" width="84.0" x="360.5" y="172.0"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="SCAN_OK" id="SCAN_OK_gui" isMarkerVisible="true">
            <omgdc:Bounds height="40.0" width="40.0" x="550.0" y="160.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
                <omgdc:Bounds height="12.0" width="102.0" x="521.0" y="127.0"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="sid-E49425CF-8287-4798-B622-D2A7D78EF00B" id="sid-E49425CF-8287-4798-B622-D2A7D78EF00B_gui">
            <omgdc:Bounds height="80.0" width="100.0" x="687.5" y="140.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-84cb49fd-2f7c-44fb-8950-83c3fa153d3b">
                <omgdc:Bounds height="36.0" width="83.14285278320312" x="695.9285736083984" y="162.0"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="END_PROCESS" id="END_PROCESS_gui">
            <omgdc:Bounds height="28.0" width="28.0" x="865.0" y="166.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
                <omgdc:Bounds height="11.0" width="62.857147216796875" x="847.5714263916016" y="196.0"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape bpmnElement="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9" id="sid-5134932A-1863-4FFA-BB3C-A4B4078B11A9_gui" isMarkerVisible="true">
            <omgdc:Bounds height="40.0" width="40.0" x="240.0" y="160.0"/>
        </bpmndi:BPMNShape>
        <bpmndi:BPMNEdge bpmnElement="sid-EE8A7BA0-5D66-4F8B-80E3-CC2751B3856A" id="sid-EE8A7BA0-5D66-4F8B-80E3-CC2751B3856A_gui">
            <omgdi:waypoint x="452.5" y="180"/>
            <omgdi:waypoint x="550.0" y="180"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="sid-8B820AF5-DC5C-4618-B854-E08B71FB55CB" id="sid-8B820AF5-DC5C-4618-B854-E08B71FB55CB_gui">
            <omgdi:waypoint x="590.0" y="180"/>
            <omgdi:waypoint x="687.5" y="180"/>
            <bpmndi:BPMNLabel labelStyle="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
                <omgdc:Bounds height="12.048704338048935" width="16.32155963195521" x="597.8850936986571" y="155"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="sid-7B791A11-2F2E-4D80-AFB3-91A02CF2B4FD" id="sid-7B791A11-2F2E-4D80-AFB3-91A02CF2B4FD_gui">
            <omgdi:waypoint x="180.0" y="180"/>
            <omgdi:waypoint x="240.0" y="180"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="sid-4DC479E5-5C20-4948-BCFC-9EC5E2F66D8D" id="sid-4DC479E5-5C20-4948-BCFC-9EC5E2F66D8D_gui">
            <omgdi:waypoint x="280.0" y="180"/>
            <omgdi:waypoint x="352.5" y="180"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="sid-57EB1F24-BD94-479A-BF1F-57F1EAA19C6C" id="sid-57EB1F24-BD94-479A-BF1F-57F1EAA19C6C_gui">
            <omgdi:waypoint x="787.5" y="180.0"/>
            <omgdi:waypoint x="865.0" y="180.0"/>
        </bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge bpmnElement="sid-337A23B9-A923-4CCE-B613-3E247B773CCE" id="sid-337A23B9-A923-4CCE-B613-3E247B773CCE_gui">
            <omgdi:waypoint x="570.5" y="200.0"/>
            <omgdi:waypoint x="570.5" y="269.0"/>
            <omgdi:waypoint x="260.5" y="269.0"/>
            <omgdi:waypoint x="260.5" y="200.0"/>
            <bpmndi:BPMNLabel labelStyle="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
                <omgdc:Bounds height="21.4285888671875" width="12.0" x="550" y="205"/>
            </bpmndi:BPMNLabel>
        </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
    <bpmndi:BPMNLabelStyle id="sid-e0502d32-f8d1-41cf-9c4a-cbb49fecf581">
        <omgdc:Font isBold="false" isItalic="false" isStrikeThrough="false" isUnderline="false" name="Arial" size="11.0"/>
    </bpmndi:BPMNLabelStyle>
    <bpmndi:BPMNLabelStyle id="sid-84cb49fd-2f7c-44fb-8950-83c3fa153d3b">
        <omgdc:Font isBold="false" isItalic="false" isStrikeThrough="false" isUnderline="false" name="Arial" size="12.0"/>
    </bpmndi:BPMNLabelStyle>
</bpmndi:BPMNDiagram>
</definitions>
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/bpmn/svg/eNrNWltz2zYWfu-v0Kgz-wYJVwJw7WR43c00cRw73ek-ZSgSkjmRSJWkYqe_fg91MyRbDtikSfVgSyDP4fedKw6k85f3i_ngk6mboiovhmSEhwNTZlVelLOL4W_vE6SGL1_8dJ6baVEWLdzUDECibC6Gt227PBuP7-7uRtViNqrq2bhZmmwcXL25HFNMMBaUj9-8jeLXw58G9mut4GyyXJR54aonevWkEpDIs9M6osjSEJ7UUDhqeBrDfXMof8fW4hRjMv79zeub7NYsUlSUTZuWmTlSYe6XtWk6679Oy9kqnZmndBGt9fj3q7S9PRJvPy_Nc4KHII6F03pm2st0YZplmoH8Mb2mOGvWgq-rLG3XEdLD64Pn7x3h7f2AsFuheHTf5EMItqyaz9NJVa8fOSjyi2FT5CjDRnIxnSLmEYN4Op0glakc0ZRMM0YnhFMO0h3w82Vat0VWLNOy3csrmfCQRB6iIiaI-1wgHfkS-ZHmQmsWYS8ZDkqwxsUwXDVttTD1cLCsqwz8c22mGy0hU5hpphFWkiIuJGQIYx6K_ZgrHoXcx3sUYwsG0Bof8IKFre49Qifdg6IJ51VjQGaazhvTLcT3Jlu16WRu9osneLyHeLkYXlal2YE0960pu_iL52ZhyrYZby_M09LcmAf7TYgnc5xLZKQH9vMAmIbwQtKbyCk2yiiWbpXu5ffCQsY8iXGEiIo54lJFKAgF_CGCeDzWjApuCa8VTOfV3WWVG7D9i5v3_vX7D1fXb8P45uZ8bF96Rij0Lz-8u_4QQjT2knn7q-vtHbeYa05FCM6iSgI3rVDgUYoi6stIqjjBOHDVF19GfVmuzUsYBxv6YF6PIZ4kPgoCFiKfBxxLFRDi6xP6zsedo3YRu3X69iNUrLqNP5ltFh04YRdilxWEuGn-9TPBv7y7HkDrMHYUVKt2VkEzWcOUgdTEJwTRhMaIRwojPwkYgkVMw4QGPInOx3uRLaYHFNuVNm0-woMWy7npMundCvKraD9D-xpucFp-79IjqeoQ7oYw3xaxgxy5ydJysEM-WD_M1mhxKaAxLnZcunyUOhZIhBQjCAHwepiESMehiGnieZECLnuRExaJY-XLwMdIRJ4HjlMBUjhmKAypFCRgSnj-Y4t0BtinbzZfNcUn8--0NXfp58Fs8z8qapNt2EZwtZ6BuGWdt78e0G9WWVcdpqv5y7UjT7J2w_sl1ipQFPuJQFEoQiglBGynBEcxVoEkSSBEGByzfqyFMelTFmjkawpBH4Yx5B1hiMWUQ6RJBiuPbXdsMMeYck30L8fbW7jQleN8lUFaldOqXmwbXTlYVJNibgaDdLnsEYpu5vySU6BEByShHAXQEDt2UEMSksB6QmLfJzr0wudDscwfaoVVyHbEXzVbuiY_ScUNxCEV8On2ye45EVblQVK4FtGTwN1K2xM-ONDiFtJf8qRbaXJMjMb8sYKJwCTQPPamcmELAVyt6syst05HrWOz89xvqpwsP34OkEtdOgR00CMsPLvy-OzjXML04HHu5cOCYufQs3BcCsBDv35sh64bHLnECeyzoFyi8JGNnCLhkbt2fnwWj0tu7Yz0P9M4Wck1cGEU2Oy_4e1m7j3rRp6oSGd1unhIK-5RrAiFjXUGYcUNjChcZyhNuYTBIGeK4d2-3VJztd5qdwvbPXyPgelhvMqz1Eih4fIUHJ56sOPPMUWCTRkTNJWMHJRt6_k3t-nyiee7DVx9xrMPs1XRNdj_VHXxZ1W26fxi2NYrczw5rE8FzoJqVebN4NYUs1uARAXuTjfuiry9vRhqxrpP9xdDTkdiOIAGKwWsjI9UWTRfpxMzH8y7vzft527WWuPm2YTrKZh1KjPwWWdlLTBMbhmbpkSA1yZH-E5jFHoEXlGCSsUoZoSKPWACA7P9InyDXo64tl9rKkTiUadHMg8rphXnj4iNj5nZI8Gxc3v53WnW6zUZfku_453f5Sm_fwX9ozb3aGhaE3EBzWzMmw8AmWyodA72_lKwGiwwzRlFU5VDkpFsinTGU5RNuhg22VQo4hyslFoYuTdiQhLOOKZYa49sAHMyUrQLaaq7rKAb8Fo-Af7vCcijWfBoOnT2h7L9QfDOIVAYt0FEOP7h1YPYDlF8h9HDO4ySfl-7dx3TGjl3afwmrT-a-r9FU6xPrJwzmdtO4DsfCCsp8A9PigMfEEx3ICnZgaTfL_h7DK09RtyvTRpPyX9Q0jDPThp21H83gLUYabubbqPt-2XTwTR9NF47u4Mqi-nmA5BT606yIeT9-PQhFkYwsOp6iqTEkxrCRmwQw56nW6Ye05DyxNs2Fe-75pXbpNLnbOHvKY-UnyyPrhaI89lThcVp5O4zoJ-K5OLsLv28rIqyXe94H3queuzwx_db_UGdpt9x7MPebeTuM6C7sRf6BJsT91vFVv0TeiNXEnPGFLzRzJpuYPtIiRDaY0QL6JabrgkbRaUE1szTUKck2RAR4i_neV83ux109TkWc3MzUf3cbGX5NwxytyOcPgc-buxpT_bsVEn4KvZuh3x9jgTd2Es7ZUcu_K0erp6r8X0t4HZk1ueAzbHIyd3IQrGbBSwJTztJUO8rJPCPHzRgoOh2qkopT5L11sg6KNoNRlu036JeHixfWd8ZH2taE94HRU_OW65J1X2N1ATV3P6Zw6s2nReZtXDT1sVH8_62rlazW2v9tzI39bwoj38O4ddFOh8OmuJPs91qjp8g98DCiWHPaeR7MqQODA8ubA-ku1XrF18v_g8GkVkz')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Bytefield diagram to an image', () => {
      const input = `
[bytefield]
....
(draw-column-headers)
(draw-box "Address" {:span 4})
(draw-box "Size" {:span 2})
(draw-box 0 {:span 2})
(draw-gap "Payload")
(draw-bottom)
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/bytefield/svg/eNrTSClKLNdNzs8pzc3TzUhNTEktKtbk0gCLJuVXKCg5pqQUpRYXKylUWxUXJOYpmNSiSAdnVqXC5YxQ5AwwhdMTCxSUAhIrc_ITU5QQaktK8nM1AW7MLSU')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Pikchr diagram to an image', () => {
      const input = `
[pikchr]
....
$r = 0.2in
linerad = 0.75*$r
linewid = 0.25

# Start and end blocks
#
box "element" bold fit
line down 50% from last box.sw
dot rad 250% color black
X0: last.e + (0.3,0)
arrow from last dot to X0
move right 3.9in
box wid 5% ht 25% fill black
X9: last.w - (0.3,0)
arrow from X9 to last box.w


# The main rule that goes straight through from start to finish
#
box "object-definition" italic fit at 11/16 way between X0 and X9
arrow to X9
arrow from X0 to last box.w

# The LABEL: rule
#
arrow right $r from X0 then down 1.25*$r then right $r
oval " LABEL " fit
arrow 50%
oval "\\":\\"" fit
arrow 200%
box "position" italic fit
arrow
line right until even with X9 - ($r,0) \
  then up until even with X9 then to X9
arrow from last oval.e right $r*0.5 then up $r*0.8 right $r*0.8
line up $r*0.45 right $r*0.45 then right
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/pikchr/svg/eNptUk1T2zAQvetX7Jgww0cxisEUZ6aHdoYbNzjkwEW2lVhF0TLyJqL_vispSV3g4NFo3-rt2_c88_ADZFkZJ6xx2qs-3b_XFzOfKsHkSlULcQJPpDyBcj1o_lqL3esoTkSL71BoqzfaUQEt2h5WhtJ76DE4qOUprDxuwKqRuOG9HIPokSAOrCLaoUXPjKp7FUu5SI2lhks4k-XNN3kulPcYJiTxNSEspdjgToM364Hgpmx4kygn6q5PgWsVHytj7YG82ZMHuPqKfNlE2qPOIOLez4OGjTIO_NZqoEERrFGPMJJXaTANHrfrIVOMySVmWRlnxuFgELa_dUdXvY5lMugKMKSs6aJZwJTz-fX8DoL6A62moLXj7ZLZy2avMC7c_KdWflSbxT7-_PXwuEhyeXx-kC2a-X8vBx6R8plzvpx4rhz6BO6UhSJz8RkjzUwc2B58KRYvxRSqJGNp3TccP22Zm_KPkcdsHRkLesdzg6Eh2s-xzDynApD1bN--6krQJz-SE1FaqY97XMiyPjKl6_0Uu89yDthtPQVv64knfwGrmf6K')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Diagrams.net diagram to an image', () => {
      const input = `
[diagramsnet]
....
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Electron" modified="2022-09-13T07:43:35.176Z" agent="5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) draw.io/20.2.8 Chrome/102.0.5005.167 Electron/19.0.15 Safari/537.36" etag="LhBTAD99BNPTPnW6KKtz" version="20.2.8" type="device">
  <diagram id="ZahvhYCcWguJS4UQkUxV" name="Page-1">
    <mxGraphModel dx="1104" dy="725" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="elJO9X42axDvzzEHx44D-1" value="" style="shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;" parent="1" vertex="1">
          <mxGeometry x="340" y="160" width="140" height="30" as="geometry" />
        </mxCell>
        <mxCell id="elJO9X42axDvzzEHx44D-4" value="" style="shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;rotation=-180;" parent="1" vertex="1">
          <mxGeometry x="320" y="200" width="140" height="30" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
....
`
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convert(input, { extension_registry: registry })
      expect(html).to.contain('https://kroki.io/diagramsnet/svg/eNq1VE1zmzAQvedXaHRKZmqQAGM7mGTy0SYTJ6k7duo2NxXWoIlAjKzY2L--Czj1dKY9tNOe2NVqP957K8bndaHIGsxK6jKm3GGUQJnoVJZZTJ_mH3pDen52NC7qpVRAcr2yMX2vILFGl5QUeHEpIY2pxzyvx0Y97s_Z4DTwT_2-wwfhMyUigxKT-g4jxwtZpnqzIo9zwpnDIoIHYRCROgxOyEVVKVjAt4m0bt8fOH5Ijie384f7d0TJFyA3kLzoE5IasXGkdj3meM6QXOVGF-By5jnM6TOGbcMBeRvR5SM85n0yE0th5L4uYrQC8d3nl_OL69Ho8nE6n5aLcDKxO3pgo-tAid1WENMU1jIBenZEyDiVIjOiIBKRP4t8nX-9ShbZ690sePr08lR_pqQUBeZMEXyPtzmYVdQ3RlT5g05BkbRGujkLKEm3MR14fUoy09TjnTGTOyzAUY_sVaawagNWa2Vl1TmJLktE2drCGOS1NZdadVUqbP7DmCVCHbyFTG0e06E36PxbkFneVOLhCFUVTRA7r3KBcjVmhwAxGK3tm9NCugKlWh7wvvvrSNvUtFvw-0ug7j6OvgSeqK_Xu9372zoIrpE6shbqFQfHYey2QYAzoRorC1VUgZEFWDCtO33zok0uLcwqkUC8QcKj3BYq5tFS1tDRyqPDRLwV3EIjBz2M1skFuFrWbAkG_QBnR6V4iN9Nxx9vzvI9dz7aAiXI9kk_I3U7qH-APfhf2I22wjYL3uND9jdMeB0THvsXTIzdw0o1scMTaV-au39q-A9yu5_Q2XelwGNC')
      expect(html).to.contain('<div class="imageblock kroki">')
    })
    it('should convert a Vega-Lite diagram and resolve data.url relative to the diagram file', async () => {
      const registry = asciidoctor.Extensions.create()
      asciidoctorKroki.register(registry)
      const html = asciidoctor.convertFile(fixturePath('docs', 'data.adoc'), { to_file: false, extension_registry: registry, safe: 'unsafe' })
      const values = fs.readFileSync(fixturePath('docs', 'diagrams', 'data', 'seattle-weather.csv'), 'utf8')
      const diagramText = JSON.stringify({
        data: {
          values,
          format: {
            type: 'csv'
          }
        },
        mark: 'tick',
        encoding: {
          x: { field: 'precipitation', type: 'quantitative' }
        }
      })
      expect(html).to.contain(`https://kroki.io/vegalite/svg/${encodeText(diagramText)}`)
    })

    describe('Diagram options', () => {
      it('should pass diagram options as query params', () => {
        const input = `
plantuml::test/fixtures/alice.puml[svg,opts=inline,theme=bluegray]
`
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, {
          safe: 'safe',
          extension_registry: registry,
          attributes: { 'allow-uri-read': '' }
        })
        const svg = fs.readFileSync(ospath.join(__dirname, 'fixtures', 'expected', 'alice-bluegray.svg'), 'utf8')
        expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
${svg}
</div>
</div>`)
      }).timeout(5000)
      it('should pass diagram options as HTTP headers', () => {
        const input = `
plantuml::test/fixtures/alice.puml[svg,opts=inline,theme=bluegray]
`
        const registry = asciidoctor.Extensions.create()
        asciidoctorKroki.register(registry)
        const html = asciidoctor.convert(input, {
          safe: 'safe',
          extension_registry: registry,
          attributes: { 'kroki-fetch-diagram': '', imagesdir: '.asciidoctor/kroki' }
        })
        const svg = fs.readFileSync(ospath.join(__dirname, 'fixtures', 'expected', 'alice-bluegray.svg'), 'utf8')
        expect(html).to.equal(`<div class="imageblock kroki">
<div class="content">
${svg}
</div>
</div>`)
      }).timeout(5000)
    })

    describe('Default options', () => {
      const defaultOptionsFixtures = [
        {
          format: 'svg',
          formatLocation: 'default',
          pageAttr: '',
          blockAttr: ''
        },
        {
          format: 'svg',
          formatLocation: 'page attribute (equals default)',
          pageAttr: ':kroki-default-format: svg',
          blockAttr: ''
        },
        {
          format: 'svg',
          formatLocation: 'page attribute overriding previous png page attribute',
          pageAttr: `:kroki-default-format: png
:kroki-default-format!:`,
          blockAttr: ''
        },
        {
          format: 'svg',
          formatLocation: 'block attribute overriding png page attribute',
          pageAttr: ':kroki-default-format: png',
          blockAttr: ',Diagram,svg'
        },
        {
          format: 'png',
          formatLocation: 'block attribute',
          pageAttr: '',
          blockAttr: ',Diagram,png'
        },
        {
          format: 'png',
          formatLocation: 'page attribute',
          pageAttr: ':kroki-default-format: png',
          blockAttr: ''
        },
        {
          format: 'svg',
          formatLocation: 'default, block attr overrides default inline',
          pageAttr: ':kroki-default-options: inline',
          blockAttr: ',Diagram,opts=none'
        },
        {
          format: 'svg',
          formatLocation: 'default, block attr overrides default interactive',
          pageAttr: ':kroki-default-options: interactive',
          blockAttr: ',Diagram,opts=none'
        },
        {
          format: 'svg',
          formatLocation: 'default, default interactive unset',
          pageAttr: `:kroki-default-options: interactive
:kroki-default-options!:`,
          blockAttr: ''
        }
      ]
      for (const { format, formatLocation, pageAttr, blockAttr } of defaultOptionsFixtures) {
        it(`should read diagram text, ${format}, ${formatLocation}`, () => {
          const input = `${pageAttr}

[plantuml${blockAttr}]
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
            const html = asciidoctor.convert(input, {
              safe: 'safe',
              extension_registry: registry,
              attributes: { 'allow-uri-read': true }
            })
            expect(html).to.contain(`<img src="https://kroki.io/plantuml/${format}/eNqLdoxVcFKIdo7lKkgsSkwvSizIAAA36QY3" alt="Diagram">`)
            expect(memoryLogger.getMessages().length).to.equal(0)
          } finally {
            asciidoctor.LoggerManager.setLogger(defaultLogger)
          }
        })
      }
      const inlineOptionsFixtures = [
        {
          location: 'page attr',
          pageAttr: ':kroki-default-options: inline',
          blockAttr: ''
        },
        {
          location: 'block attr',
          pageAttr: '',
          blockAttr: ',opts=inline'
        },
        {
          location: 'block attr overriding page attr',
          pageAttr: ':kroki-default-options: interactive',
          blockAttr: ',opts=inline'
        }
      ]
      for (const { location, pageAttr, blockAttr } of inlineOptionsFixtures) {
        it(`should inline (via ${location}) an SVG image with built-in allow-uri-read (available in Asciidoctor.js 2+)`, () => {
          const input = `
:imagesdir: .asciidoctor/kroki
${pageAttr}

plantuml::test/fixtures/alice.puml[svg,role=sequence${blockAttr}]
`
          const registry = asciidoctor.Extensions.create()
          asciidoctorKroki.register(registry)
          const html = asciidoctor.convert(input, {
            safe: 'safe',
            extension_registry: registry,
            attributes: { 'allow-uri-read': true }
          })
          const svg = fs.readFileSync(ospath.join(__dirname, 'fixtures', 'expected', 'alice.svg'), 'utf8')
          expect(html).to.equal(`<div class="imageblock sequence kroki-format-svg kroki">
<div class="content">
${svg}
</div>
</div>`)
        }).timeout(5000)
        it(`should inline (via ${location}) an SVG image with kroki-fetch-diagram`, () => {
          const input = `
:imagesdir: .asciidoctor/kroki
${pageAttr}

bytefield::test/fixtures/simple.bytefield[svg,role=bytefield${blockAttr}]
`
          const registry = asciidoctor.Extensions.create()
          asciidoctorKroki.register(registry)
          const html = asciidoctor.convert(input, {
            safe: 'safe',
            extension_registry: registry,
            attributes: { 'kroki-fetch-diagram': true }
          })
          expect(html).to.contain('<svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" width="681" height="116" viewBox="0 0 681 116" ><text x="60" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >0</text><text x="100" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >1</text><text x="140" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >2</text><text x="180" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >3</text><text x="220" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >4</text><text x="260" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >5</text><text x="300" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >6</text><text x="340" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >7</text><text x="380" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >8</text><text x="420" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >9</text><text x="460" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >a</text><text x="500" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >b</text><text x="540" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >c</text><text x="580" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >d</text><text x="620" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >e</text><text x="660" y="8" font-family="Courier New, monospace" font-size="11" dominant-baseline="middle" text-anchor="middle" >f</text><line x1="40" y1="15" x2="200" y2="15" stroke="#000000" stroke-width="1" /><line x1="40" y1="45" x2="200" y2="45" stroke="#000000" stroke-width="1" /><line x1="200" y1="15" x2="200" y2="45" stroke="#000000" stroke-width="1" /><line x1="40" y1="15" x2="40" y2="45" stroke="#000000" stroke-width="1" /><text font-size="18" font-family="Palatino, Georgia, Times New Roman, serif" x="120" y="31" text-anchor="middle" dominant-baseline="middle" >Address</text><line x1="200" y1="15" x2="280" y2="15" stroke="#000000" stroke-width="1" /><line x1="200" y1="45" x2="280" y2="45" stroke="#000000" stroke-width="1" /><line x1="280" y1="15" x2="280" y2="45" stroke="#000000" stroke-width="1" /><line x1="200" y1="15" x2="200" y2="45" stroke="#000000" stroke-width="1" /><text font-size="18" font-family="Palatino, Georgia, Times New Roman, serif" x="240" y="31" text-anchor="middle" dominant-baseline="middle" >Size</text><line x1="280" y1="15" x2="360" y2="15" stroke="#000000" stroke-width="1" /><line x1="280" y1="45" x2="360" y2="45" stroke="#000000" stroke-width="1" /><line x1="360" y1="15" x2="360" y2="45" stroke="#000000" stroke-width="1" /><line x1="280" y1="15" x2="280" y2="45" stroke="#000000" stroke-width="1" /><text font-size="18" font-family="Courier New, monospace" x="320" y="31" text-anchor="middle" dominant-baseline="middle" >0000</text><line x1="360" y1="15" x2="680" y2="15" stroke="#000000" stroke-width="1" /><line x1="680" y1="15" x2="680" y2="45" stroke="#000000" stroke-width="1" /><line x1="360" y1="15" x2="360" y2="45" stroke="#000000" stroke-width="1" /><text font-size="18" font-family="Palatino, Georgia, Times New Roman, serif" x="520" y="31" text-anchor="middle" dominant-baseline="middle" >Payload</text><text font-size="11" font-family="Courier New, monospace" font-style="normal" dominant-baseline="middle" x="35" y="30" text-anchor="end" >00</text><text font-size="11" font-family="Courier New, monospace" font-style="normal" dominant-baseline="middle" x="35" y="60" text-anchor="end" >10</text><line x1="40" y1="45" x2="40" y2="60" stroke="#000000" stroke-width="1" /><line x1="680" y1="45" x2="680" y2="60" stroke="#000000" stroke-width="1" /><line stroke-dasharray="1,1" x1="40" y1="60" x2="680" y2="90" stroke="#000000" stroke-width="1" /><line x1="680" y1="45" x2="680" y2="90" stroke="#000000" stroke-width="1" /><line stroke-dasharray="1,1" x1="40" y1="70" x2="680" y2="100" stroke="#000000" stroke-width="1" /><line x1="40" y1="70" x2="40" y2="100" stroke="#000000" stroke-width="1" /><line x1="40" y1="100" x2="40" y2="115" stroke="#000000" stroke-width="1" /><line x1="680" y1="100" x2="680" y2="115" stroke="#000000" stroke-width="1" /><text font-size="11" font-family="Palatino, Georgia, Times New Roman, serif" font-style="italic" dominant-baseline="middle" x="35" y="130" text-anchor="end" >i+<tspan font-size="11" font-family="Courier New, monospace" font-style="normal" dominant-baseline="middle" >00</tspan></text><line x1="40" y1="115" x2="680" y2="115" stroke="#000000" stroke-width="1" /></svg>')
        }).timeout(5000)
      }

      const interactiveOptionsFixtures = [
        {
          location: 'page attr',
          pageAttr: ':kroki-default-options: interactive',
          blockAttr: ''
        },
        {
          location: 'block attr',
          pageAttr: '',
          blockAttr: ',opts=interactive'
        },
        {
          location: 'block attr overriding page attr',
          pageAttr: ':kroki-default-options: inline',
          blockAttr: ',opts=interactive'
        }
      ]
      for (const { location, pageAttr, blockAttr } of interactiveOptionsFixtures) {
        it(`should include an interactive (via ${location}) SVG image with built-in allow-uri-read and data-uri (available in Asciidoctor.js 2+)`, () => {
          const input = `
:imagesdir: .asciidoctor/kroki
${pageAttr}

vegalite::test/fixtures/chart.vlite[svg,role=chart${blockAttr}]
`
          const registry = asciidoctor.Extensions.create()
          asciidoctorKroki.register(registry)
          const html = asciidoctor.convert(input, {
            safe: 'safe',
            extension_registry: registry,
            attributes: { 'data-uri': true, 'allow-uri-read': true }
          })
          expect(html).to.contain('<object type="image/svg+xml" data="data:image/svg+xml;base64,PHN2Zy')
        }).timeout(5000)
        it(`should include an interactive (via ${location}) SVG image with kroki-fetch-diagram`, () => {
          const input = `
:imagesdir: .asciidoctor/kroki
${pageAttr}

plantuml::test/fixtures/alice.puml[svg,role=sequence${blockAttr}]
`
          const registry = asciidoctor.Extensions.create()
          asciidoctorKroki.register(registry)
          const html = asciidoctor.convert(input, {
            safe: 'safe',
            extension_registry: registry,
            attributes: { 'kroki-fetch-diagram': true }
          })
          const file = fixturePath('alice.puml')
          const hash = rusha.createHash().update(`https://kroki.io/plantuml/svg/${encode(file)}`).digest('hex')
          expect(html).to.contain(`<object type="image/svg+xml" data=".asciidoctor/kroki/diag-${hash}.svg"><span class="alt">Diagram</span></object>`)
        })
      }
    })
  })
})
