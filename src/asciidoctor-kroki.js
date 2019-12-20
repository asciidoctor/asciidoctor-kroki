const pako = require('pako')

function UnsupportedFormatError (message) {
  this.name = 'UnsupportedFormatError'
  this.message = message
  this.stack = (new Error()).stack
}

// eslint-disable-next-line new-parens
UnsupportedFormatError.prototype = new Error

function InvalidConfigurationError (message) {
  this.name = 'InvalidConfigurationError'
  this.message = message
  this.stack = (new Error()).stack
}

// eslint-disable-next-line new-parens
InvalidConfigurationError.prototype = new Error

const getServerUrl = (doc) => doc.getAttribute('kroki-server-url') || 'https://kroki.io'

const createImageSrc = (doc, text, type, target, format, vfs) => {
  const serverUrl = getServerUrl(doc)
  const shouldFetch = doc.isAttribute('kroki-fetch-diagram')
  const data = Buffer.from(text, 'utf8')
  const compressed = pako.deflate(data, { level: 9 })
  const base64 = Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_')
  let diagramUrl = `${serverUrl}/${type}/${format}/${base64}`
  if (shouldFetch) {
    diagramUrl = require('./fetch').save(diagramUrl, doc, target, format, vfs)
  }
  return diagramUrl
}

const processKroki = (processor, parent, attrs, diagramType, diagramText, context) => {
  const doc = parent.getDocument()
  // If "subs" attribute is specified, substitute accordingly.
  // Be careful not to specify "specialcharacters" or your diagram code won't be valid anymore!
  const subs = attrs.subs
  if (subs) {
    diagramText = parent.$apply_subs(diagramText, parent.$resolve_subs(subs), true)
  }
  const role = attrs.role
  const blockId = attrs.id
  const title = attrs.title
  const target = attrs.target
  const format = attrs.format || 'svg'
  const imageUrl = createImageSrc(doc, diagramText, diagramType, target, format, context.vfs)
  const blockAttrs = {
    role: role ? `${role} kroki` : 'kroki',
    target: imageUrl,
    alt: target || 'diagram',
    title
  }
  if (blockId) {
    blockAttrs.id = blockId
  }
  return processor.createImageBlock(parent, blockAttrs)
}

function diagramBlock (context) {
  return function () {
    const self = this
    self.onContext(['listing', 'literal'])
    self.positionalAttributes(['target', 'format'])
    self.process((parent, reader, attrs) => {
      const diagramType = this.name.toString()
      const role = attrs.role
      let diagramText = reader.$read()
      try {
        return processKroki(this, parent, attrs, diagramType, diagramText, context)
      } catch (e) {
        console.warn(`Skipping ${diagramType} block. ${e.message}`)
        attrs.role = role ? `${role} kroki-error` : 'kroki-error'
        return this.createBlock(parent, attrs['cloaked-context'], diagramText, attrs)
      }
    })
  }
}

function diagramBlockMacro (name, context) {
  return function () {
    const self = this
    self.named(name)
    self.process((parent, target, attrs) => {
      let vfs = context.vfs
      if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
        vfs = require('./node-fs')
      }
      const role = attrs.role
      const diagramType = name
      target = parent.$apply_subs(target, ['attributes'])
      try {
        const diagramText = vfs.read(target)
        return processKroki(this, parent, attrs, diagramType, diagramText, context)
      } catch (e) {
        console.warn(`Skipping ${diagramType} block macro. ${e.message}`)
        attrs.role = role ? `${role} kroki-error` : 'kroki-error'
        return this.createBlock(parent, 'paragraph', `${e.message} - ${diagramType}::${target}[]`, attrs)
      }
    })
  }
}

module.exports.register = function register (registry, context = {}) {
  const names = ['plantuml', 'ditaa', 'graphviz', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'c4plantuml', 'erd', 'mermaid', 'nomnoml', 'svgbob', 'umlet']
  if (typeof registry.register === 'function') {
    registry.register(function () {
      for (let name of names) {
        this.block(name, diagramBlock(context))
        this.blockMacro(diagramBlockMacro(name, context))
      }
    })
  } else if (typeof registry.block === 'function') {
    for (let name of names) {
      registry.block(name, diagramBlock(context))
      registry.blockMacro(diagramBlockMacro(name, context))
    }
  }
  return registry
}
