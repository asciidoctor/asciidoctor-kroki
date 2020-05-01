// @ts-check
/**
 * @param {string} diagramText
 * @param {unknown} context
 * @returns {string}
 */
module.exports.preprocessVegaLite = function (diagramText, context) {
  let diagramObject
  try {
    const JSON5 = require('json5')
    diagramObject = JSON5.parse(diagramText)
  } catch (e) {
    console.warn(`Skipping preprocessing of vegalite diagram because of parsing error:  ${e}`)
    return diagramText
  }

  if (!diagramObject || !diagramObject.data || !diagramObject.data.url) {
    return diagramText
  }

  let vfs = context["vfs"]
  if (typeof vfs === 'undefined' || typeof vfs.read !== 'function') {
    vfs = require('./node-fs')
  }
  const data = diagramObject.data
  try {
    data.values = vfs.read(data.url)
  } catch (e) {
    console.warn(`Skipping preprocessing of vegalite diagram because of read error:  ${e}`)
    return diagramText
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
  return JSON.stringify(diagramObject, undefined, 2)
}
