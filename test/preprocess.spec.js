/* global describe it */

// @ts-check
// The previous line must be the first non-comment line in the file to enable TypeScript checks:
// https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html#ts-check

const fs = require('fs')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')
const path = require('path')
const url = require('url')

chai.use(dirtyChai)

const { preprocessVegaLite } = require('../src/preprocess.js')

describe('Vega-Lite preprocessing', () => {
  const cwd = process.cwd().replace(/\\/g, '/')
  const relativePath = 'test/fixtures/vegalite-data.csv'
  const diagramTextWithInlinedCsvFile = JSON.stringify({
    data: {
      values: fs.readFileSync(`${path.join(cwd, relativePath)}`, 'utf8'),
      format: {
        type: 'csv'
      }
    }
  })

  /**
   * @param {string} diagramText
   * @param {string} expectedErrorMessage
   * @param {string} [baseDir]
   * @returns {void}
   */
  function expectToThrow (diagramText, expectedErrorMessage, baseDir) {
    expect(() => preprocessVegaLite(diagramText, {}, baseDir)).to.throw(expectedErrorMessage)
  }

  /**
   * @param {string} diagramText
   * @param {string} expectedPreprocessedDiagramText
   * @param {string} [baseDir]
   * @returns {void}
   */
  function expectToBeEqual (diagramText, expectedPreprocessedDiagramText, baseDir) {
    expect(preprocessVegaLite(diagramText, {}, baseDir).replace(/\r\n/g, '\n')).to.be.equal(expectedPreprocessedDiagramText)
  }

  it('should throw an error for invalid JSON', () => {
    expectToThrow('invalid JSON', `Preprocessing of Vega-Lite view specification failed, because of a parsing error:
SyntaxError: JSON5: invalid character 'i' at 1:1
The invalid view specification was:
invalid JSON`)
  })

  it('should return original diagramText for valid JSON but without "data.url"', () => {
    const validJsonWithoutDataUrl = '{}'
    expectToBeEqual(validJsonWithoutDataUrl, validJsonWithoutDataUrl)
  })

  it('should throw an error for unexisting local file referenced with relative path', () => {
    const diagramText = `{
  "data": {
    "url": "unexisting.csv"
  }
}`
    const errorMessage = `Preprocessing of Vega-Lite view specification failed, because reading the local data file 'unexisting.csv' referenced in the diagram caused an error:
Error: ENOENT: no such file or directory, open 'unexisting.csv'`
    expectToThrow(diagramText, errorMessage)
  })

  it('should throw an error for unexisting file referenced with "file" protocol', () => {
    const unexistingFileUrl = url.pathToFileURL(path.join(cwd, 'unexisting.csv'))
    const diagramText = `{
      "data": {
        "url": "${unexistingFileUrl}"
      }
    }`
    const unexistingPath = url.fileURLToPath(unexistingFileUrl)
    const errorMessage = `Preprocessing of Vega-Lite view specification failed, because reading the local data file '${unexistingFileUrl}' referenced in the diagram caused an error:
Error: ENOENT: no such file or directory, open '${unexistingPath}'`
    expectToThrow(diagramText, errorMessage)
  })

  it('should warn and return original diagramText for unexisting remote file referenced with "http" protocol, because it can perhaps be found by kroki server', () => {
    const diagramText = `{
  "data": {
    "url": "https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/unexisting.csv"
  }
}`
    expectToBeEqual(diagramText, diagramText)
  })

  it('should return diagramText with inlined local file referenced with relative path', () => {
    const diagramText = `{
  "data": {
    "url": "${relativePath}"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile)
  })

  it('should return diagramText with inlined local file referenced with relative path and base dir', () => {
    const diagramText = `{
  "data": {
    "url": "vegalite-data.csv"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile, 'test/fixtures/')
  })

  it('should return diagramText with inlined local file referenced with absolute path', () => {
    const diagramText = `{
  "data": {
    "url": "${cwd}/${relativePath}"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile)
  })

  it('should return diagramText with inlined local file referenced with absolute path and base dir (which should not be used)', () => {
    const diagramText = `{
  "data": {
    "url": "${cwd}/${relativePath}"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile, 'test/fixtures/')
  })

  it('should return diagramText with inlined local file referenced with "file" protocol and absolute path', () => {
    const fileUrl = url.pathToFileURL(cwd) + '/' + relativePath
    const diagramText = `{
  "data": {
    "url": "${fileUrl}"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile)
  })

  it('should return diagramText with inlined remote file referenced with "http" protocol', () => {
    const diagramText = `{
  "data": {
    "url": "https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/${relativePath}"
  }
}`
    expectToBeEqual(diagramText, diagramTextWithInlinedCsvFile)
  })
})

const { preprocessPlantUML } = require('../src/preprocess.js')

describe('PlantUML preprocessing', () => {
  // TODO: change after merge to upstream project
  const remoteBasePath = 'https://raw.githubusercontent.com/anb0s/asciidoctor-kroki/plantuml-include/'
  // const remoteBasePath = 'https://raw.githubusercontent.com/Mogztter/asciidoctor-kroki/master/'
  const localUnexistingFilePath = 'test/fixtures/plantuml/unexisting.iuml'
  const localExistingFilePath = 'test/fixtures/plantuml/style-general.iuml'

  it('should return original diagramText without "!include ..."', () => {
    const diagramTextWithoutInclude = `
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithoutInclude, {})).to.be.equal(diagramTextWithoutInclude)
  })

  it('should warn and return original diagramText for standard library file referenced with "!include <std-lib-file>", because it can perhaps be found by kroki server', () => {
    const diagramTextWithStdLibIncludeFile = `
      !include <std/include.iuml>
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithStdLibIncludeFile, {})).to.be.equal(diagramTextWithStdLibIncludeFile)
  })

  it('should warn and return original diagramText for unexisting local file referenced with "!include local-file-or-url", because it can perhaps be found by kroki server', () => {
    const diagramTextWithUnexistingLocalIncludeFile = `
      !include ${localUnexistingFilePath}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithUnexistingLocalIncludeFile, {})).to.be.equal(diagramTextWithUnexistingLocalIncludeFile)
  })

  it('should warn and return original diagramText for unexisting remote file referenced with "!include remote-url", because it can perhaps be found by kroki server', () => {
    const remoteUnexistingIncludeFilePath = `${remoteBasePath}${localUnexistingFilePath}`
    const diagramTextWithUnexistingRemoteIncludeFile = `
      !include ${remoteUnexistingIncludeFilePath}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithUnexistingRemoteIncludeFile, {})).to.be.equal(diagramTextWithUnexistingRemoteIncludeFile)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file-or-url"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file-or-url" and first "@startuml ... @enduml" block', () => {
    const localExistingFileNameWithBlocksPath = 'test/fixtures/plantuml/style-general.puml'
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithBlocksPath}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file-name-with-spaces # trailing comment"', () => {
    const localExistingFileNameWithSpacesPath = 'test/fixtures/plantuml/style general with spaces.iuml'
    const localExistingFileNameWithSpacesPathEscaped = localExistingFileNameWithSpacesPath.replace(/ /g, '\\ ')
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithSpacesPathEscaped} # this includes general style
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFileNameWithSpacesPath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText} # this includes general style
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file(s) referenced multiple times with "!include local-file-or-url"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file(s) referenced multiple times with "!include_many local-file-or-url"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include_many ${localExistingFilePath}
      alice -> bob
      !include_many ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should throw an error for local file(s) referenced multiple times with "!include_once local-file-or-url"', () => {
    const localExistingFilePathNormalized = path.normalize(localExistingFilePath)
    const diagramTextWithExistingLocalIncludeOneFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include_once ${localExistingFilePath}`
    const errorMessage = `Preprocessing of PlantUML include failed, because including multiple times referenced file '${localExistingFilePathNormalized}' with '!include_once' guard`
    expect(() => preprocessPlantUML(diagramTextWithExistingLocalIncludeOneFile, {})).to.throw(errorMessage)
  })

  it('should throw an error for local file(s) referenced multiple times nested with "!include_once local-file-or-url"', () => {
    const localExistingFileNameIncldudeOncePath = 'test/fixtures/plantuml/style-include-once-style-general.iuml'
    const localExistingFilePathNormalized = path.normalize(localExistingFilePath)
    const diagramTextWithExistingLocalIncludeOneFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFileNameIncldudeOncePath}`
    const errorMessage = `Preprocessing of PlantUML include failed, because including multiple times referenced file '${localExistingFilePathNormalized}' with '!include_once' guard`
    expect(() => preprocessPlantUML(diagramTextWithExistingLocalIncludeOneFile, {})).to.throw(errorMessage)
  })

  it('should return diagramText with inlined local file(s) referenced multiple times with "!include_once local-file-or-url ... !include local-file-or-url"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText while preserving inline and block comments"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      '!include ${localExistingFilePath}' the whole line is preserved
      !include ${localExistingFilePath}
      /'
        !include ${localExistingFilePath}
        the whole block is preserved
      '/ alice -> bob /' this also should be preserved '/`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
      '!include ${localExistingFilePath}' the whole line is preserved
${includedText}
      /'
        !include ${localExistingFilePath}
        the whole block is preserved
      '/ alice -> bob /' this also should be preserved '/`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText while preserving trailing block comment"', () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath} /'
      this is a trailing block comment
      '/`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText} /'
      this is a trailing block comment
      '/`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file-name-with-spaces"', () => {
    const localExistingFileNameWithSpacesPath = 'test/fixtures/plantuml/style general with spaces.iuml'
    const localExistingFileNameWithSpacesPathEscaped = localExistingFileNameWithSpacesPath.replace(/ /g, '\\ ')
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithSpacesPathEscaped}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFileNameWithSpacesPath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined remote file referenced with "!include remote-url"', () => {
    const remoteIncludeFilePath = `${remoteBasePath}${localExistingFilePath}`
    const diagramTextWithExistingRemoteIncludeFile = `
      !include ${remoteIncludeFilePath}
      alice -> bob`.replace(/\r\n/g, '\n')
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8').replace(/\r\n/g, '\n')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingRemoteIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined remote file referenced with "!includeurl remote-url"', () => {
    const remoteIncludeFilePath = `${remoteBasePath}${localExistingFilePath}`
    const diagramTextWithExistingRemoteIncludeFile = `
      !includeurl ${remoteIncludeFilePath}
      alice -> bob`.replace(/\r\n/g, '\n')
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8').replace(/\r\n/g, '\n')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingRemoteIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined multiple local files referenced with "!include local-file-or-url"', () => {
    const localExistingFilePath1 = 'test/fixtures/plantuml/style-note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/style-sequence.iuml'
    const diagramTextWithExistingLocalIncludeFiles = `
      !include ${localExistingFilePath}
      !include ${localExistingFilePath1}
      !include ${localExistingFilePath2}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const includedText2 = fs.readFileSync(`${localExistingFilePath2}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
${includedText1}
${includedText2}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingLocalIncludeFiles, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined recursive local files referenced with "!include local-file-or-url"', () => {
    const localExistingFilePath0 = 'test/fixtures/plantuml/style.iuml'
    const localExistingFilePath1 = 'test/fixtures/plantuml/style-note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/style-sequence.iuml'
    const diagramTextWithExistingRecursiveLocalIncludeFile = `
      !include ${localExistingFilePath0}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const includedText2 = fs.readFileSync(`${localExistingFilePath2}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
${includedText1}
${includedText2}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingRecursiveLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined recursive local files referenced with "!include local-file-name-with-spaces"', () => {
    const localExistingFileNameWithSpacesPath = 'test/fixtures/plantuml/style general with spaces.iuml'
    const localExistingFilePath0WithSpaces = 'test/fixtures/plantuml/style with spaces.iuml'
    const localExistingFilePath0WithSpacesEscaped = localExistingFilePath0WithSpaces.replace(/ /g, '\\ ')
    const localExistingFilePath1 = 'test/fixtures/plantuml/style-note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/style-sequence.iuml'
    const diagramTextWithExistingRecursiveLocalIncludeFile = `
      !include ${localExistingFilePath0WithSpacesEscaped}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFileNameWithSpacesPath}`, 'utf8')
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const includedText2 = fs.readFileSync(`${localExistingFilePath2}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
${includedText1}
${includedText2}
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingRecursiveLocalIncludeFile, {})).to.be.equal(diagramTextWithIncludedText)
  })

  it('should throw an error for file recursive included itself', () => {
    const localExistingFileIncludesItselfPath = 'test/fixtures/plantuml/file-include-itself.iuml'
    const localExistingFileIncludesItselfPathNormalized = path.normalize(localExistingFileIncludesItselfPath)
    const diagramTextWithIncludeItself = `
      !include ${localExistingFileIncludesItselfPath}
      alice -> bob`
    const errorMessage = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${localExistingFileIncludesItselfPathNormalized}'`
    expect(() => preprocessPlantUML(diagramTextWithIncludeItself, {})).to.throw(errorMessage)
  })

  it('should throw an error for file recursive included grand parent file', () => {
    const localExistingFileGrandParentName = 'file-include-grand-parent.iuml'
    const localExistingFileGrandParentPath = 'test/fixtures/plantuml/' + localExistingFileGrandParentName
    const localExistingFileGrandParentPathNormalized = path.normalize(localExistingFileGrandParentPath)
    const diagramTextWithIncludeGrandParent = `
      !include ${localExistingFileGrandParentPath}
      alice -> bob`
    const errorMessage = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${localExistingFileGrandParentPathNormalized}'`
    expect(() => preprocessPlantUML(diagramTextWithIncludeGrandParent, {})).to.throw(errorMessage)
  })

  it('should return diagramText with inlined local file referenced with "!includesub local-file!sub-name"', () => {
    const localExistingFilePathWithSubs = 'test/fixtures/plantuml/file-with-subs.puml!BASIC'
    const diagramTextWithExistingIncludeFileWithSubs = `
      !includesub ${localExistingFilePathWithSubs}
      alice -> bob`
    const diagramTextWithIncludedText = `
B -> B : stuff2
B -> B : stuff2.1
D -> D : stuff4
D -> D : stuff4.1
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingIncludeFileWithSubs, {}).replace(/\r\n/g, '\n')).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file!id"', () => {
    const localExistingFilePathWithID1 = 'test/fixtures/plantuml/file-with-id.puml!MY_OWN_ID1'
    const localExistingFilePathWithID2 = 'test/fixtures/plantuml/file-with-id.puml!MY_OWN_ID2'
    const diagramTextWithExistingIncludeFileWithID = `
      !include ${localExistingFilePathWithID1}
      !include ${localExistingFilePathWithID2}
      alice -> bob`
    const diagramTextWithIncludedText = `
A -> A : stuff1
B -> B : stuff2
C -> C : stuff3
D -> D : stuff4
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingIncludeFileWithID, {}).replace(/\r\n/g, '\n')).to.be.equal(diagramTextWithIncludedText)
  })

  it('should return diagramText with inlined local file referenced with "!include local-file!index"', () => {
    const localExistingFilePathWithIndex0 = 'test/fixtures/plantuml/file-with-index.puml!0'
    const localExistingFilePathWithIndex1 = 'test/fixtures/plantuml/file-with-index.puml!1'
    const diagramTextWithExistingIncludeFileWithIndex = `
      !include ${localExistingFilePathWithIndex0}
      !include ${localExistingFilePathWithIndex1}
      alice -> bob`
    const diagramTextWithIncludedText = `
A -> A : stuff1
B -> B : stuff2
C -> C : stuff3
D -> D : stuff4
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingIncludeFileWithIndex, {}).replace(/\r\n/g, '\n')).to.be.equal(diagramTextWithIncludedText)
  })

  it('should resolve include path relative to the included file', () => {
    const diagramTextWithExistingIncludeFileWithIndex = `
      !include test/fixtures/plantuml/dir/subdir/handwritten.iuml
      alice -> bob`
    const diagramTextWithIncludedText = `
skinparam Handwritten true
skinparam DefaultFontName "Neucha"
skinparam BackgroundColor black
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingIncludeFileWithIndex, {})
      .replace(/\r\n/g, '\n'))
      .to.be.equal(diagramTextWithIncludedText)
  })

  it('should include a PlantUML file from an absolute path', () => {
    // eslint-disable-next-line
    const diagramTextWithExistingIncludeFileWithIndex = `
      !include ${__dirname}/fixtures/plantuml/dir/subdir/handwritten.iuml
      alice -> bob`
    const diagramTextWithIncludedText = `
skinparam Handwritten true
skinparam DefaultFontName "Neucha"
skinparam BackgroundColor black
      alice -> bob`
    expect(preprocessPlantUML(diagramTextWithExistingIncludeFileWithIndex, {})
      .replace(/\r\n/g, '\n'))
      .to.be.equal(diagramTextWithIncludedText)
  })

  it('should remove all PlantUml tags', () => {
    const diagramTextWithTags = `
      @startuml
      alice -> bob
      @enduml

      @startuml(id="another diagram")
      here -> there
      @enduml`

    const result = preprocessPlantUML(diagramTextWithTags, {})
    expect(result).to.not.contain('@startuml')
    expect(result).to.not.contain('@enduml')
    expect(result.trim()).to.be.eq(`alice -> bob
      here -> there`
    )
  })
})
