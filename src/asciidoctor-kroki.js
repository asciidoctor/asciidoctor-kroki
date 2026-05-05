// @ts-check

import fetch from './fetch.js'
import httpClient from './http/http-client.js'
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
]

const wrapError = (err, message) => {
  const errWrapper = new Error(message)
  errWrapper.stack += `\nCaused by: ${err.stack || 'unknown'}`
  const result = {
    err: {
      package: 'asciidoctor-kroki',
      message,
      stack: errWrapper.stack,
    },
  }
  result.$inspect = function () {
    return JSON.stringify(this.err)
  }
  return result
}

const createImageSrc = async (doc, krokiDiagram, target, vfs, krokiClient) => {
  if (
    doc.isAttribute('kroki-fetch-diagram') &&
    doc.getSafe() < SAFE_MODE_SECURE
  ) {
    return fetch.save(krokiDiagram, doc, target, vfs, krokiClient)
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
  return /^[1-9]\d*$/.test(value)
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
        const errorMessage = wrapError(err, `Skipping ${diagramType} block.`)
        logger.warn(errorMessage)
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
        const errorMessage = wrapError(err, `Skipping ${diagramType} block.`)
        parent.getDocument().getLogger().warn(errorMessage)
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
