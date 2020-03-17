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

const getTextContent = (doc, text, type, format, vfs) => {
  const serverUrl = getServerUrl(doc)
  const data = Buffer.from(text, 'utf8')
  const compressed = pako.deflate(data, { level: 9 })
  const base64 = Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_')
  const diagramUrl = `${serverUrl}/${type}/${format}/${base64}`
  return require('./fetch').getTextContent(diagramUrl, vfs)
}

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
    diagramText = parent.applySubstitutions(diagramText, parent.$resolve_subs(subs))
  }
  const blockId = attrs.id
  const title = attrs.title
  const format = attrs.format || 'svg'
  let role = attrs.role
  if (role) {
    if (format) {
      role = `${role} kroki-format-${format} kroki`
    } else {
      role = `${role} kroki`
    }
  } else {
    role = 'kroki'
  }
  const blockAttrs = {
    role,
    title,
    format
  }
  const inline = attrs['inline-option'] === ''
  if (inline) {
    blockAttrs['inline-option'] = ''
  }
  const interactive = attrs['interactive-option'] === ''
  if (interactive) {
    blockAttrs['interactive-option'] = ''
  }
  if (blockId) {
    blockAttrs.id = blockId
  }
  if (format === 'txt' || format === 'atxt' || format === 'utxt') {
    const content = getTextContent(doc, diagramText, diagramType, format, context.vfs)
    return processor.createBlock(parent, 'literal', content, blockAttrs, {})
  } else {
    const target = attrs.target
    const imageUrl = createImageSrc(doc, diagramText, diagramType, target, format, context.vfs)
    const imageBlockAttrs = Object.assign({}, blockAttrs, {
      target: imageUrl,
      alt: target || 'diagram'
    })
    return processor.createImageBlock(parent, imageBlockAttrs)
  }
}

function diagramBlock (context) {
  return function () {
    const self = this
    self.onContext(['listing', 'literal'])
    self.positionalAttributes(['target', 'format'])
    self.process((parent, reader, attrs) => {
      const diagramType = this.name.toString()
      const role = attrs.role
      const diagramText = reader.$read()
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
      target = parent.applySubstitutions(target, ['attributes'])
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
  // patch context in case of Antora
  if (typeof context.contentCatalog !== 'undefined' && typeof context.contentCatalog.addFile === 'function' && typeof context.file !== 'undefined') {
    context.vfs = require('./antora-adapter')(context.file, context.contentCatalog, context.vfs)
  }
  const names = ['plantuml', 'ditaa', 'graphviz', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'c4plantuml', 'erd', 'mermaid', 'nomnoml', 'svgbob', 'umlet', 'vega', 'vegalite', 'wavedrom']
  if (typeof registry.register === 'function') {
    registry.register(function () {
      for (const name of names) {
        this.block(name, diagramBlock(context))
        this.blockMacro(diagramBlockMacro(name, context))
      }
    })
  } else if (typeof registry.block === 'function') {
    for (const name of names) {
      registry.block(name, diagramBlock(context))
      registry.blockMacro(diagramBlockMacro(name, context))
    }
  }
  return registry
}
