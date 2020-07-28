const path = require('path')

// @ts-check
/**
 * @param {string} diagramText
 * @param {any} context
 * @returns {string}
 */
module.exports.preprocessVegaLite = function (diagramText, context) {
  let diagramObject
  try {
    const JSON5 = require('json5')
    diagramObject = JSON5.parse(diagramText)
  } catch (e) {
    const message = `Preprocessing of Vega-Lite view specification failed, because of a parsing error:
${e}
The invalid view specification was:
${diagramText}
`
    throw addCauseToError(new Error(message), e)
  }

  if (!diagramObject || !diagramObject.data || !diagramObject.data.url) {
    return diagramText
  }
  const vfs = context.vfs
  const read = typeof vfs !== 'undefined' && typeof vfs.read === 'function' ? vfs.read : require('./node-fs.js').read
  const data = diagramObject.data
  try {
    data.values = read(data.url)
  } catch (e) {
    if (isRemoteUrl(data.url)) {
      // Only warn and do not throw an error, because the data file can perhaps be found by kroki server (https://github.com/yuzutech/kroki/issues/60)
      console.warn(`Skipping preprocessing of Vega-Lite view specification, because reading the referenced remote file '${data.url}' caused an error:\n${e}`)
      return diagramText
    }
    const message = `Preprocessing of Vega-Lite view specification failed, because reading the referenced local file '${data.url}' caused an error:\n${e}`
    throw addCauseToError(new Error(message), e)
  }

  if (!data.format) {
    // Extract extension from URL using snippet from
    // http://stackoverflow.com/questions/680929/how-to-extract-extension-from-filename-string-in-javascript
    // Same code as in Vega-Lite:
    // https://github.com/vega/vega-lite/blob/master/src/compile/data/source.ts
    let type = /(?:\.([^.]+))?$/.exec(data.url)[1]
    if (['json', 'csv', 'tsv', 'dsv', 'topojson'].indexOf(type) < 0) {
      type = 'json'
    }
    data.format = { type: type }
  }
  data.url = undefined
  // reconsider once #42 is fixed:
  // return JSON.stringify(diagramObject, undefined, 2)
  return JSON.stringify(diagramObject)
}

/**
 * Removes all plantuml tags (@startuml/@enduml) from the diagram
 * It's possible to have more than one diagram in a single file in the cli version of plantuml
 * This does not work for the server, so recent plantuml versions remove the tags before processing the diagram
 * We don't want to rely on the server to handle this, so we remove the tags in here before sending the diagram to the server
 *
 * Some diagrams have special tags (ie. @startmindmap for mindmap) - these are mandatory, so we can't do much about them...
 *
 * @param diagramText
 * @returns {string} diagramText without any plantuml tags
 */
function removePlantUmlTags (diagramText) {
  if (diagramText) {
    diagramText = diagramText.replace(/^\s*@(startuml|enduml).*\n?/gm, '')
  }
  return diagramText
}

/**
 * @param {string} diagramText
 * @param {any} context
 * @param {string} baseDir - base directory
 * @returns {string}
 */
module.exports.preprocessPlantUML = function (diagramText, context, baseDir = '.') {
  const includeOnce = []
  const includeStack = []
  diagramText = preprocessPlantUmlIncludes(diagramText, baseDir, includeOnce, includeStack, context.vfs)
  return removePlantUmlTags(diagramText)
}

/**
 * @param {string} diagramText
 * @param {string} dirPath
 * @param {string[]} includeOnce
 * @param {string[]} includeStack
 * @param {any} vfs
 * @returns {string}
 */
function preprocessPlantUmlIncludes (diagramText, dirPath, includeOnce, includeStack, vfs) {
  // see: http://plantuml.com/en/preprocessing
  const regExInclude = /^\s*!(include(?:_many|_once|url|sub)?)\s+((?:(?<=\\)[ ]|[^ ])+)(.*)/
  const regExTrailingComment = /^\s+[#|\\/']/
  const diagramLines = diagramText.split('\n')
  let insideCommentBlock = false
  const diagramProcessed = diagramLines.map(line => {
    let result = line
    // replace the !include directive unless inside a comment block
    if (!insideCommentBlock) {
      result = line.replace(
        regExInclude,
        (match, ...args) => {
          const include = args[0].toLowerCase()
          const urlSub = args[1].trim().split('!')
          const trailingContent = args[2]
          const url = urlSub[0].replace(/\\ /g, ' ')
          const sub = urlSub[1]
          const result = readPlantUmlInclude(url, dirPath, includeStack, vfs)
          if (result.skip) {
            return line
          }
          if (include === 'include_once') {
            checkIncludeOnce(result.text, result.filePath, includeOnce)
          }
          let text = result.text
          if (sub !== undefined && sub !== null && sub !== '') {
            if (include === 'includesub') {
              text = getPlantUmlTextFromSub(text, sub)
            } else {
              const index = parseInt(sub, 10)
              if (isNaN(index)) {
                text = getPlantUmlTextFromId(text, sub)
              } else {
                text = getPlantUmlTextFromIndex(text, index)
              }
            }
          } else {
            text = getPlantUmlTextOrFirstBlock(text)
          }
          includeStack.push(result.filePath)
          text = preprocessPlantUmlIncludes(text, path.dirname(result.filePath), includeOnce, includeStack, vfs)
          includeStack.pop()
          if (trailingContent.match(regExTrailingComment)) {
            return text + trailingContent
          }
          return text
        })
    }
    if (line.includes('/\'')) {
      insideCommentBlock = true
    }
    if (insideCommentBlock && line.includes('\'/')) {
      insideCommentBlock = false
    }
    return result
  })
  return diagramProcessed.join('\n')
}

/**
 * @param {string} url
 * @param {string} dirPath
 * @param {string[]} includeStack
 * @param {any} vfs
 * @returns {any}
 */
function readPlantUmlInclude (url, dirPath, includeStack, vfs) {
  const exists = typeof vfs !== 'undefined' && typeof vfs.exists === 'function' ? vfs.exists : require('./node-fs.js').exists
  const read = typeof vfs !== 'undefined' && typeof vfs.read === 'function' ? vfs.read : require('./node-fs.js').read
  let skip = false
  let text = ''
  let filePath = url
  if (url.startsWith('<')) {
    // Only warn and do not throw an error, because the std-lib includes can perhaps be found by kroki server
    console.warn(`Skipping preprocessing of PlantUML standard library include file '${url}'`)
    skip = true
  } else if (includeStack.includes(url)) {
    const message = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${url}'`
    throw new Error(message)
  } else {
    if (isRemoteUrl(url)) {
      try {
        text = read(url)
      } catch (e) {
        // Only warn and do not throw an error, because the data file can perhaps be found by kroki server (https://github.com/yuzutech/kroki/issues/60)
        console.warn(`Skipping preprocessing of PlantUML include, because reading the referenced remote file '${url}' caused an error:\n${e}`)
        skip = true
      }
    } else {
      filePath = path.join(dirPath, url)
      if (!exists(filePath)) {
        filePath = url
      }
      if (includeStack.includes(filePath)) {
        const message = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${filePath}'`
        throw new Error(message)
      } else {
        try {
          text = read(filePath)
        } catch (e) {
          const message = `Preprocessing of PlantUML include failed, because reading the referenced local file '${filePath}' caused an error:\n${e}`
          throw addCauseToError(new Error(message), e)
        }
      }
    }
  }
  return { skip: skip, text: text, filePath: filePath }
}

/**
 * @param {string} text
 * @param {string} sub
 * @returns {string}
 */
function getPlantUmlTextFromSub (text, sub) {
  const regEx = new RegExp(`!startsub\\s+${sub}(?:\\r\\n|\\n)([\\s\\S]*?)(?:\\r\\n|\\n)!endsub`, 'gm')
  return getPlantUmlTextRegEx(text, regEx)
}

/**
 * @param {string} text
 * @param {string} id
 * @returns {string}
 */
function getPlantUmlTextFromId (text, id) {
  const regEx = new RegExp(`@startuml\\(id=${id}\\)(?:\\r\\n|\\n)([\\s\\S]*?)(?:\\r\\n|\\n)@enduml`, 'gm')
  return getPlantUmlTextRegEx(text, regEx)
}

/**
 * @param {string} text
 * @param {RegExp} regEx
 * @returns {string}
 */
function getPlantUmlTextRegEx (text, regEx) {
  let matchedStrings = ''
  let match = regEx.exec(text)
  if (match != null) {
    matchedStrings += match[1]
    match = regEx.exec(text)
    while (match != null) {
      matchedStrings += '\n' + match[1]
      match = regEx.exec(text)
    }
  }
  return matchedStrings
}

/**
 * @param {string} text
 * @param {int} index
 * @returns {string}
 */
function getPlantUmlTextFromIndex (text, index) {
  const regEx = new RegExp('@startuml(?:\\r\\n|\\n)([\\s\\S]*?)(?:\\r\\n|\\n)@enduml', 'gm')
  let idx = -1
  let matchedStrings = ''
  let match = regEx.exec(text)
  while (match != null && idx < index) {
    if (++idx === index) {
      matchedStrings += match[1]
    } else {
      match = regEx.exec(text)
    }
  }
  return matchedStrings
}

/**
 * @param {string} text
 * @returns {string}
 */
function getPlantUmlTextOrFirstBlock (text) {
  const regEx = new RegExp('@startuml(?:\\r\\n|\\n)([\\s\\S]*?)(?:\\r\\n|\\n)@enduml', 'gm')
  let matchedStrings = text
  const match = regEx.exec(text)
  if (match != null) {
    matchedStrings = match[1]
  }
  return matchedStrings
}

/**
 * @param {string} text
 * @param {string} filePath
 * @param {string[]} includeOnce
 */
function checkIncludeOnce (text, filePath, includeOnce) {
  if (includeOnce.includes(filePath)) {
    const message = `Preprocessing of PlantUML include failed, because including multiple times referenced file '${filePath}' with '!include_once' guard`
    throw new Error(message)
  } else {
    includeOnce.push(filePath)
  }
}

/**
 * @param {Error} error
 * @param {any} causedBy
 * @returns {Error}
 */
function addCauseToError (error, causedBy) {
  if (causedBy.stack) {
    error.stack += '\nCaused by: ' + causedBy.stack
  }
  return error
}

/**
 * @param {string} string
 * @returns {boolean}
 */
function isRemoteUrl (string) {
  try {
    const url = new URL(string)
    return url.protocol !== 'file:'
  } catch (_) {
    return false
  }
}
