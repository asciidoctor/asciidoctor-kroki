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

  let vfs = context.vfs
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    vfs = require('./node-fs.js')
  }
  const data = diagramObject.data
  try {
    data.values = vfs.read(data.url)
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
