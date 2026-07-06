// @ts-check

import fetch from './fetch.js'
import httpClient from './http-client.js'
import { KrokiClient, KrokiDiagram } from './kroki-client.js'
import fs from './node-fs.js'
import {
  preprocessPlantUML,
  preprocessStructurizr,
  preprocessVegaLite,
} from './preprocess.js'

const isBrowser = () => typeof window === 'object'

// A value of 20 (SECURE) disallows the document from attempting to read files from the file system
const SAFE_MODE_SECURE = 20

const BUILTIN_ATTRIBUTES = [
  'target',
  'width',
  'height',
  'format',
  'fallback',
  'link',
  'float',
  'align',
  'role',
  'title',
  'caption',
  'cloaked-context',
  '$positional',
  'subs',
  'opts',
]

/**
 * Build an auto-formatting log message describing a skipped diagram block.
 *
 * Delegates to the document's `messageWithContext` (Logger.AutoFormattingMessage)
 * so the message carries a structured `source_location` — recorded as-is by a
 * MemoryLogger — while still rendering the location inline through
 * `inspect()`/`toString()` when a stderr Logger formats the line.
 *
 * @param {Object} doc - Asciidoctor document.
 * @param {Error} err - The error that caused the block to be skipped.
 * @param {string} diagramType - The diagram type (e.g. "plantuml").
 * @param {Object} [sourceLocation] - Reader cursor pointing at the block, if any.
 * @returns {Object|string} An auto-formatting log message.
 */
const skipDiagramMessage = (doc, err, diagramType, sourceLocation) => {
  const text = `Skipping ${diagramType} block: ${err.message || err}`
  if (typeof doc.messageWithContext === 'function') {
    return doc.messageWithContext(text, { source_location: sourceLocation })
  }
  // Fallback for Asciidoctor versions without the logging mixin on Document.
  if (!sourceLocation) {
    return text
  }
  const message = { text, source_location: sourceLocation }
  message.inspect = message.toString = () => `${sourceLocation}: ${text}`
  return message
}

const createImageSrc = async (
  doc,
  krokiDiagram,
  target,
  vfs,
  krokiClient,
  inline,
) => {
  if (
    doc.isAttribute('kroki-fetch-diagram') &&
    doc.getSafe() < SAFE_MODE_SECURE
  ) {
    return fetch.save(krokiDiagram, doc, target, vfs, krokiClient)
  }
  // The `inline` option asks the converter to embed the diagram (e.g. inline
  // SVG). The converter can fetch the content itself from the server URL when
  // `allow-uri-read` is set; otherwise it has no way to obtain it, so resolve the
  // diagram to a data-URI here. We still only set the image target — the
  // converter decides how to render it — so DocBook, PDF and other backends keep
  // working from the same data-URI image.
  if (
    inline &&
    !doc.isAttribute('allow-uri-read') &&
    doc.getSafe() < SAFE_MODE_SECURE
  ) {
    return fetch.toDataUri(krokiDiagram, krokiClient)
  }
  return krokiDiagram.getDiagramUri(krokiClient.getServerUrl())
}

/**
 * Get the option defined on the block or macro.
 *
 * First, check if an option is defined as an attribute.
 * If there is no match, check if an option is defined as a default settings in the document attributes.
 *
 * @param attrs - list of attributes
 * @param document - Asciidoctor document
 * @returns {string|undefined} - the option name or undefined
 */
function getOption(attrs, document) {
  const availableOptions = ['inline', 'interactive', 'none']
  for (const option of availableOptions) {
    if (attrs[`${option}-option`] === '') {
      return option
    }
  }
  for (const option of availableOptions) {
    if (document.getAttribute('kroki-default-options') === option) {
      return option
    }
  }
}

function isNumeric(value) {
  return /^\d+$/.test(value)
}

const processKroki = async (
  processor,
  parent,
  attrs,
  diagramType,
  diagramText,
  context,
  resource,
) => {
  const doc = parent.getDocument()
  // If "subs" attribute is specified, substitute accordingly.
  // Be careful not to specify "specialcharacters" or your diagram code won't be valid anymore!
  const subs = attrs.subs
  if (subs) {
    diagramText = await parent.applySubs(diagramText, parent.resolveSubs(subs))
  }
  if (doc.getSafe() < SAFE_MODE_SECURE) {
    if (diagramType === 'vegalite') {
      diagramText = await preprocessVegaLite(
        diagramText,
        context,
        resource?.dir || '',
      )
    } else if (diagramType === 'plantuml' || diagramType === 'c4plantuml') {
      const plantUmlIncludeFile = doc.getAttribute('kroki-plantuml-include')
      if (plantUmlIncludeFile) {
        diagramText = `!include ${plantUmlIncludeFile}\n${diagramText}`
      }
      const plantUmlIncludePaths = doc.getAttribute(
        'kroki-plantuml-include-paths',
      )
      diagramText = await preprocessPlantUML(
        diagramText,
        context,
        plantUmlIncludePaths,
        resource,
      )
    } else if (diagramType === 'structurizr') {
      diagramText = await preprocessStructurizr(diagramText, context, resource)
    }
  }
  const blockId = attrs.id
  const format =
    attrs.format || doc.getAttribute('kroki-default-format') || 'svg'
  const caption = attrs.caption
  const title = attrs.title
  const role = attrs.role
    ? `${attrs.role} kroki-format-${format} kroki`
    : 'kroki'
  const blockAttrs = Object.assign({}, attrs)
  blockAttrs.role = role
  blockAttrs.format = format
  delete blockAttrs.title
  delete blockAttrs.caption
  delete blockAttrs.opts
  const option = getOption(attrs, doc)
  if (option && option !== 'none') {
    blockAttrs[`${option}-option`] = ''
  }

  if (blockId) {
    blockAttrs.id = blockId
  }
  const opts = Object.fromEntries(
    Object.entries(attrs).filter(
      ([key, _]) =>
        !key.endsWith('-option') &&
        !BUILTIN_ATTRIBUTES.includes(key) &&
        !isNumeric(key),
    ),
  )
  const krokiDiagram = new KrokiDiagram(diagramType, format, diagramText, opts)
  const krokiClient = new KrokiClient(doc, httpClient)
  let block
  if (format === 'txt' || format === 'atxt' || format === 'utxt') {
    const textContent = await krokiClient.getTextContent(krokiDiagram)
    block = processor.createBlock(parent, 'literal', textContent, blockAttrs)
  } else {
    let alt
    if (attrs.title) {
      alt = attrs.title
    } else if (attrs.target) {
      alt = attrs.target
    } else {
      alt = 'Diagram'
    }
    blockAttrs.target = await createImageSrc(
      doc,
      krokiDiagram,
      attrs.target,
      context.vfs,
      krokiClient,
      option === 'inline',
    )
    blockAttrs.alt = alt
    block = processor.createImageBlock(parent, blockAttrs)
  }
  if (title) {
    block.title = title
  }
  block.assignCaption(caption, 'figure')
  return block
}

function diagramBlock(context) {
  return function () {
    this.onContext(['listing', 'literal'])
    this.positionalAttributes(['target', 'format'])
    this.process(async (parent, reader, attrs) => {
      const diagramType = this.name.toString()
      const role = attrs.role
      // Capture the cursor at the block start before read() advances it.
      const sourceLocation = reader?.cursor
      const diagramText = await reader.read()
      const logger = parent.getDocument().getLogger()
      try {
        context.logger = logger
        return await processKroki(
          this,
          parent,
          attrs,
          diagramType,
          diagramText,
          context,
        )
      } catch (err) {
        const doc = parent.getDocument()
        logger.warn(skipDiagramMessage(doc, err, diagramType, sourceLocation))
        attrs.role = role ? `${role} kroki-error` : 'kroki-error'
        return this.createBlock(
          parent,
          attrs['cloaked-context'],
          diagramText,
          attrs,
        )
      }
    })
  }
}

function diagramBlockMacro(name, context) {
  return function () {
    this.named(name)
    this.positionalAttributes(['format'])
    this.process(async (parent, target, attrs) => {
      let vfs = context.vfs
      target = await parent.applySubs(target, ['attributes'])
      if (isBrowser()) {
        if (
          !['file://', 'https://', 'http://'].some((prefix) =>
            target.startsWith(prefix),
          )
        ) {
          // if not an absolute URL, prefix with baseDir in the browser environment
          const doc = parent.getDocument()
          const baseDir = doc.getBaseDir()
          const startDir = typeof baseDir !== 'undefined' ? baseDir : '.'
          target =
            startDir !== '.' ? doc.normalizeWebPath(target, startDir) : target
        }
        if (vfs === undefined || typeof vfs.read !== 'function') {
          vfs = {
            read: async (path, encoding = 'utf8') => {
              const response = await globalThis.fetch(path)
              if (!response.ok) throw new Error(`No such file: ${path}`)
              if (encoding === 'binary') {
                const buf = await response.arrayBuffer()
                return String.fromCharCode(...new Uint8Array(buf))
              }
              return response.text()
            },
            exists: (path) =>
              path.startsWith('http://') || path.startsWith('https://'),
            add: (_) => {},
            parse: (path) => ({
              dir: path.substring(0, path.lastIndexOf('/')),
              path,
            }),
          }
          context.vfs = vfs
        }
      } else {
        if (vfs === undefined || typeof vfs.read !== 'function') {
          vfs = fs
          target = parent.normalizeSystemPath(target)
        }
      }
      context.logger = parent.getDocument().getLogger()
      const role = attrs.role
      const diagramType = name
      try {
        const diagramText = await vfs.read(target)
        const resource = (typeof vfs.parse === 'function' &&
          vfs.parse(target)) || { dir: '' }
        return await processKroki(
          this,
          parent,
          attrs,
          diagramType,
          diagramText,
          context,
          resource,
        )
      } catch (err) {
        const doc = parent.getDocument()
        doc.getLogger().warn(skipDiagramMessage(doc, err, diagramType))
        attrs.role = role ? `${role} kroki-error` : 'kroki-error'
        return this.createBlock(
          parent,
          'paragraph',
          `${err.message} - ${diagramType}::${target}[]`,
          attrs,
        )
      }
    })
  }
}

export default {
  register: (registry, context = {}) => {
    const names = [
      'actdiag',
      'blockdiag',
      'bpmn',
      'bytefield',
      'c4plantuml',
      'd2',
      'dbml',
      'ditaa',
      'erd',
      'excalidraw',
      'goat',
      'graphviz',
      'mermaid',
      'nomnoml',
      'nwdiag',
      'packetdiag',
      'pikchr',
      'plantuml',
      'rackdiag',
      'seqdiag',
      'svgbob',
      'symbolator',
      'tikz',
      'umlet',
      'vega',
      'vegalite',
      'wavedrom',
      'structurizr',
      'diagramsnet',
      'wireviz',
    ]
    for (const name of names) {
      registry.block(name, diagramBlock(context))
      registry.blockMacro(diagramBlockMacro(name, context))
    }
    return registry
  },
}
