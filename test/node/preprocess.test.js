// @ts-check
// The previous line must be the first non-comment line in the file to enable TypeScript checks:
// https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html#ts-check

import assert from 'node:assert'
import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { describe, test } from 'node:test'
import url, { fileURLToPath } from 'node:url'
import { convertFile, Extensions, MemoryLogger } from '@asciidoctor/core'
import asciidoctorKroki from '../../src/asciidoctor-kroki.js'
import {
  preprocessPlantUML,
  preprocessStructurizr,
  preprocessVegaLite,
} from '../../src/preprocess.js'
import { assertNotContains } from './utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function assertRejects(fn, expected) {
  if (expected instanceof RegExp) {
    await assert.rejects(fn, expected)
  } else {
    await assert.rejects(fn, (err) => {
      assert.ok(
        err.message.includes(expected),
        `Expected error message to include:\n${expected}\n\nActual:\n${err.message}`,
      )
      return true
    })
  }
}

describe('Vega-Lite preprocessing', { timeout: 30000 }, () => {
  const cwd = process.cwd().replace(/\\/g, '/')
  const relativePath = 'test/fixtures/vegalite-data.csv'
  const diagramTextWithInlinedCsvFile = JSON.stringify({
    data: {
      values: fs.readFileSync(`${path.join(cwd, relativePath)}`, 'utf8'),
      format: {
        type: 'csv',
      },
    },
  })

  /**
   * @param {string} result
   * @param {string} expected
   * @returns {void}
   */
  function expectToBeEqualIgnoreNewlines(result, expected) {
    assert.strictEqual(result, expected.replace(/\r\n/g, '\n'))
  }

  test('throws an error for invalid JSON', async () => {
    await assertRejects(
      () => preprocessVegaLite('invalid JSON'),
      `Preprocessing of Vega-Lite view specification failed, because of a parsing error:
SyntaxError: JSON5: invalid character 'i' at 1:1
The invalid view specification was:
invalid JSON`,
    )
  })

  test('returns original diagramText for valid JSON but without "data.url"', async () => {
    const validJsonWithoutDataUrl = '{}'
    assert.strictEqual(
      await preprocessVegaLite(validJsonWithoutDataUrl),
      validJsonWithoutDataUrl,
    )
  })

  test('throws an error for unexisting local file referenced with relative path', async () => {
    const diagramText = `{
  "data": {
    "url": "unexisting.csv"
  }
}`
    await assertRejects(
      () => preprocessVegaLite(diagramText),
      /Error: ENOENT.*unexisting\.csv/,
    )
  })

  test('throws an error for unexisting file referenced with "file" protocol', async () => {
    const unexistingFileUrl = url.pathToFileURL(
      path.join(cwd, 'unexisting.csv'),
    )
    const diagramText = `{
      "data": {
        "url": "${unexistingFileUrl}"
      }
    }`
    const unexistingPath = url.fileURLToPath(unexistingFileUrl)
    await assertRejects(
      () => preprocessVegaLite(diagramText),
      `Preprocessing of Vega-Lite view specification failed, because reading the local data file '${unexistingFileUrl}' referenced in the diagram caused an error:
Error: ENOENT: no such file or directory, open '${unexistingPath}'`,
    )
  })

  test('logs and returns original diagramText for unexisting remote file referenced with "http" protocol, because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const diagramText = `{
  "data": {
    "url": "https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/unexisting.csv"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText, { logger: memoryLogger }),
      diagramText,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.ok(
      logs[0].message.includes(
        "Skipping preprocessing of Vega-Lite view specification, because reading the remote data file 'https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/unexisting.csv' referenced in the diagram caused an error:",
      ),
    )
  })

  test('returns diagramText with inlined local file referenced with relative path', async () => {
    const diagramText = `{
  "data": {
    "url": "${relativePath}"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText),
      diagramTextWithInlinedCsvFile,
    )
  })

  test('returns diagramText with inlined local file referenced with relative path and base dir', async () => {
    const diagramText = `{
  "data": {
    "url": "vegalite-data.csv"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText, {}, 'test/fixtures/'),
      diagramTextWithInlinedCsvFile,
    )
  })

  test('returns diagramText with inlined local file referenced with absolute path', async () => {
    const diagramText = `{
  "data": {
    "url": "${cwd}/${relativePath}"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText),
      diagramTextWithInlinedCsvFile,
    )
  })

  test('returns diagramText with inlined local file referenced with absolute path and base dir (which should not be used)', async () => {
    const diagramText = `{
  "data": {
    "url": "${cwd}/${relativePath}"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText, {}, 'test/fixtures/'),
      diagramTextWithInlinedCsvFile,
    )
  })

  test('returns diagramText with inlined local file referenced with "file" protocol and absolute path', async () => {
    const fileUrl = `${url.pathToFileURL(cwd)}/${relativePath}`
    const diagramText = `{
  "data": {
    "url": "${fileUrl}"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText),
      diagramTextWithInlinedCsvFile,
    )
  })

  test('returns diagramText with inlined remote file referenced with "http" protocol', async () => {
    const diagramText = `{
  "data": {
    "url": "https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/${relativePath}"
  }
}`
    expectToBeEqualIgnoreNewlines(
      await preprocessVegaLite(diagramText),
      diagramTextWithInlinedCsvFile,
    )
  })
})

describe('PlantUML preprocessing', { timeout: 30000 }, () => {
  const remoteBasePath =
    'https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/'
  const localUnexistingFilePath = 'test/fixtures/plantuml/unexisting.iuml'
  const localExistingFilePath = 'test/fixtures/plantuml/styles/general.iuml'

  test('returns original diagramText without "!include ..."', async () => {
    const diagramTextWithoutInclude = `
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithoutInclude, {}),
      diagramTextWithoutInclude,
    )
  })

  test('logs and returns original diagramText for standard library file referenced with "!include <std-lib-file>", because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const diagramTextWithStdLibIncludeFile = `
      !include <std/include.iuml>
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithStdLibIncludeFile, {
        logger: memoryLogger,
      }),
      diagramTextWithStdLibIncludeFile,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.strictEqual(
      logs[0].message,
      "Skipping preprocessing of PlantUML standard library include '<std/include.iuml>'",
    )
  })

  test('logs and returns original diagramText for unexisting local file referenced with "!include local-file-or-url", because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const diagramTextWithUnexistingLocalIncludeFile = `
      !include ${localUnexistingFilePath}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithUnexistingLocalIncludeFile, {
        logger: memoryLogger,
      }),
      diagramTextWithUnexistingLocalIncludeFile,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.ok(
      logs[0].message.includes(
        `Skipping preprocessing of PlantUML include, because reading the referenced local file '${localUnexistingFilePath}' caused an error:`,
      ),
    )
  })

  test('logs and returns original diagramText for unexisting remote file referenced with "!include remote-url", because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const remoteUnexistingIncludeFilePath = `${remoteBasePath}${localUnexistingFilePath}`
    const diagramTextWithUnexistingRemoteIncludeFile = `
      !include ${remoteUnexistingIncludeFilePath}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithUnexistingRemoteIncludeFile, {
        logger: memoryLogger,
      }),
      diagramTextWithUnexistingRemoteIncludeFile,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.ok(
      logs[0].message.includes(
        `Skipping preprocessing of PlantUML include, because reading the referenced remote file '${remoteUnexistingIncludeFilePath}' caused an error:`,
      ),
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-or-url", diagramText with Windows EOL line endings (\\r\\n)', async () => {
    const localStyleSheetPath = 'test/fixtures/docs/diagrams/style.puml'
    const diagramTextWithExistingLocalIncludeFile = `!include ${localStyleSheetPath} \r\n\r\nBob->Alice: Hello\r\n`
    const includedText = fs.readFileSync(`${localStyleSheetPath}`, 'utf8')
    const diagramTextWithIncludedText = `${includedText}\n\r\nBob->Alice: Hello\r\n`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-or-url" and first "@startuml ... @enduml" block', async () => {
    const localExistingFileNameWithBlocksPath =
      'test/fixtures/plantuml/styles/general.puml'
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithBlocksPath}
      alice -> bob`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-name-with-spaces # trailing comment"', async () => {
    const localExistingFileNameWithSpacesPath =
      'test/fixtures/plantuml/styles/general with spaces.iuml'
    const localExistingFileNameWithSpacesPathEscaped =
      localExistingFileNameWithSpacesPath.replace(/ /g, '\\ ')
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithSpacesPathEscaped} # this includes general style
      alice -> bob`
    const includedText = fs.readFileSync(
      `${localExistingFileNameWithSpacesPath}`,
      'utf8',
    )
    const diagramTextWithIncludedText = `
${includedText} # this includes general style
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file(s) referenced multiple times with "!include local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file(s) referenced multiple times with "!include_many local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include_many ${localExistingFilePath}
      alice -> bob
      !include_many ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('throws an error for local file(s) referenced multiple times with "!include_once local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeOneFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include_once ${localExistingFilePath}`
    const errorMessage = `Preprocessing of PlantUML include failed, because including multiple times referenced file '${localExistingFilePath}' with '!include_once' guard`
    await assertRejects(
      () => preprocessPlantUML(diagramTextWithExistingLocalIncludeOneFile, {}),
      errorMessage,
    )
  })

  test('throws an error for local file(s) referenced multiple times nested with "!include_once local-file-or-url"', async () => {
    const localExistingFileNameIncludedOncePath =
      'test/fixtures/plantuml/styles/style-include-once-general.iuml'
    const diagramTextWithExistingLocalIncludeOneFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFileNameIncludedOncePath}`
    const errorMessage = `Preprocessing of PlantUML include failed, because including multiple times referenced file '${localExistingFilePath}' with '!include_once' guard`
    await assertRejects(
      () => preprocessPlantUML(diagramTextWithExistingLocalIncludeOneFile, {}),
      errorMessage,
    )
  })

  test('returns diagramText with inlined local file(s) referenced multiple times with "!include_once local-file-or-url ... !include local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include_once ${localExistingFilePath}
      alice -> bob
      !include ${localExistingFilePath}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob
${includedText}`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText while preserving inline and block comments"', async () => {
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
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText while preserving trailing block comment"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFilePath} /'
      this is a trailing block comment
      '/`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText} /'
      this is a trailing block comment
      '/`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-name-with-spaces"', async () => {
    const localExistingFileNameWithSpacesPath =
      'test/fixtures/plantuml/styles/general with spaces.iuml'
    const localExistingFileNameWithSpacesPathEscaped =
      localExistingFileNameWithSpacesPath.replace(/ /g, '\\ ')
    const diagramTextWithExistingLocalIncludeFile = `
      !include ${localExistingFileNameWithSpacesPathEscaped}
      alice -> bob`
    const includedText = fs.readFileSync(
      `${localExistingFileNameWithSpacesPath}`,
      'utf8',
    )
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined remote file referenced with "!include remote-url"', async () => {
    const remoteIncludeFilePath = `${remoteBasePath}${localExistingFilePath}`
    const diagramTextWithExistingRemoteIncludeFile = `
      !include ${remoteIncludeFilePath}
      alice -> bob`.replace(/\r\n/g, '\n')
    const includedText = fs
      .readFileSync(`${localExistingFilePath}`, 'utf8')
      .replace(/\r\n/g, '\n')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingRemoteIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined remote file referenced with "!includeurl remote-url"', async () => {
    const remoteIncludeFilePath = `${remoteBasePath}${localExistingFilePath}`
    const diagramTextWithExistingRemoteIncludeFile = `
      !includeurl ${remoteIncludeFilePath}
      alice -> bob`.replace(/\r\n/g, '\n')
    const includedText = fs
      .readFileSync(`${localExistingFilePath}`, 'utf8')
      .replace(/\r\n/g, '\n')
    const diagramTextWithIncludedText = `
${includedText}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingRemoteIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined multiple local files referenced with "!include local-file-or-url"', async () => {
    const localExistingFilePath1 = 'test/fixtures/plantuml/styles/note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/styles/sequence.iuml'
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
    assert.strictEqual(
      await preprocessPlantUML(diagramTextWithExistingLocalIncludeFiles, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined recursive local files referenced with "!include local-file-or-url"', async () => {
    const localExistingFilePath0 = 'test/fixtures/plantuml/styles/style.iuml'
    const localExistingFilePath1 = 'test/fixtures/plantuml/styles/note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/styles/sequence.iuml'
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
    assert.strictEqual(
      await preprocessPlantUML(
        diagramTextWithExistingRecursiveLocalIncludeFile,
        {},
      ),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined recursive local files referenced with "!include local-file-name-with-spaces"', async () => {
    const localExistingFileNameWithSpacesPath =
      'test/fixtures/plantuml/styles/general with spaces.iuml'
    const localExistingFilePath0WithSpaces =
      'test/fixtures/plantuml/styles/style with spaces.iuml'
    const localExistingFilePath0WithSpacesEscaped =
      localExistingFilePath0WithSpaces.replace(/ /g, '\\ ')
    const localExistingFilePath1 = 'test/fixtures/plantuml/styles/note.iuml'
    const localExistingFilePath2 = 'test/fixtures/plantuml/styles/sequence.iuml'
    const diagramTextWithExistingRecursiveLocalIncludeFile = `
      !include ${localExistingFilePath0WithSpacesEscaped}
      alice -> bob`
    const includedText = fs.readFileSync(
      `${localExistingFileNameWithSpacesPath}`,
      'utf8',
    )
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const includedText2 = fs.readFileSync(`${localExistingFilePath2}`, 'utf8')
    const diagramTextWithIncludedText = `
${includedText}
${includedText1}
${includedText2}
      alice -> bob`
    assert.strictEqual(
      await preprocessPlantUML(
        diagramTextWithExistingRecursiveLocalIncludeFile,
        {},
      ),
      diagramTextWithIncludedText,
    )
  })

  test('throws an error for file recursive included itself', async () => {
    const localExistingFileIncludesItselfPath =
      'test/fixtures/plantuml/include/itself.iuml'
    const diagramTextWithIncludeItself = `
      !include ${localExistingFileIncludesItselfPath}
      alice -> bob`
    const errorMessage = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${localExistingFileIncludesItselfPath}'`
    await assertRejects(
      () => preprocessPlantUML(diagramTextWithIncludeItself, {}),
      errorMessage,
    )
  })

  test('throws an error for file recursive included grand parent file', async () => {
    const localExistingFileGrandParentName = 'grand-parent.iuml'
    const localExistingFileGrandParentPath = `test/fixtures/plantuml/include/${localExistingFileGrandParentName}`
    const diagramTextWithIncludeGrandParent = `
      !include ${localExistingFileGrandParentPath}
      alice -> bob`
    const errorMessage = `Preprocessing of PlantUML include failed, because recursive reading already included referenced file '${localExistingFileGrandParentPath}'`
    await assertRejects(
      () => preprocessPlantUML(diagramTextWithIncludeGrandParent, {}),
      errorMessage,
    )
  })

  test('returns diagramText with inlined local file referenced with "!includesub local-file!sub-name"', async () => {
    const localExistingFilePathWithSubs =
      'test/fixtures/plantuml/diagrams/subs.puml!BASIC'
    const diagramTextWithExistingIncludeFileWithSubs = `
      !includesub ${localExistingFilePathWithSubs}
      alice -> bob`
    const diagramTextWithIncludedText = `
B -> B : stuff2
B -> B : stuff2.1
D -> D : stuff4
D -> D : stuff4.1
      alice -> bob`
    assert.strictEqual(
      (
        await preprocessPlantUML(diagramTextWithExistingIncludeFileWithSubs, {})
      ).replace(/\r\n/g, '\n'),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file!id"', async () => {
    const localExistingFilePathWithID1 =
      'test/fixtures/plantuml/diagrams/id.puml!MY_OWN_ID1'
    const localExistingFilePathWithID2 =
      'test/fixtures/plantuml/diagrams/id.puml!MY_OWN_ID2'
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
    assert.strictEqual(
      (
        await preprocessPlantUML(diagramTextWithExistingIncludeFileWithID, {})
      ).replace(/\r\n/g, '\n'),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file!index"', async () => {
    const localExistingFilePathWithIndex0 =
      'test/fixtures/plantuml/diagrams/index.puml!0'
    const localExistingFilePathWithIndex1 =
      'test/fixtures/plantuml/diagrams/index.puml!1'
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
    assert.strictEqual(
      (
        await preprocessPlantUML(
          diagramTextWithExistingIncludeFileWithIndex,
          {},
        )
      ).replace(/\r\n/g, '\n'),
      diagramTextWithIncludedText,
    )
  })

  test('resolves include path relative to the included file', async () => {
    const diagramTextWithExistingIncludeFile = `
      !include test/fixtures/plantuml/include/parent/child/handwritten.iuml
      alice -> bob`
    const diagramTextWithIncludedText = `
skinparam Handwritten true
skinparam DefaultFontName "Neucha"
skinparam BackgroundColor black
      alice -> bob`
    assert.strictEqual(
      (
        await preprocessPlantUML(diagramTextWithExistingIncludeFile, {})
      ).replace(/\r\n/g, '\n'),
      diagramTextWithIncludedText,
    )
  })

  test('includes a PlantUML file from an absolute path', async () => {
    // eslint-disable-next-line
    const diagramTextWithExistingIncludeFile = `
      !include ${__dirname}/../fixtures/plantuml/include/parent/child/handwritten.iuml
      alice -> bob`
    const diagramTextWithIncludedText = `
skinparam Handwritten true
skinparam DefaultFontName "Neucha"
skinparam BackgroundColor black
      alice -> bob`
    assert.strictEqual(
      (
        await preprocessPlantUML(diagramTextWithExistingIncludeFile, {})
      ).replace(/\r\n/g, '\n'),
      diagramTextWithIncludedText,
    )
  })

  test('removes all PlantUml tags', async () => {
    const diagramTextWithTags = `
      @startuml
      alice -> bob
      @enduml

      @startuml(id="another diagram")
      here -> there
      @enduml`

    const result = await preprocessPlantUML(diagramTextWithTags, {})
    assertNotContains(result, '@startuml')
    assertNotContains(result, '@enduml')
    assert.strictEqual(
      result.trim(),
      `alice -> bob
      here -> there`,
    )
  })

  test('resolves PlantUML includes from the diagram directory', async () => {
    const registry = Extensions.create()
    asciidoctorKroki.register(registry)
    const file = path.join(__dirname, '..', 'fixtures', 'docs', 'hello.adoc')
    const html = await convertFile(file, {
      safe: 'safe',
      extension_registry: registry,
      to_file: false,
    })
    assert.ok(
      html.includes(
        'https://kroki.io/plantuml/svg/eNorzs7MK0gsSsxVyM3Py0_OKMrPTVUoKSpN5eJyyk_StXPMyUxOtVLwSM3JyQcAc1EPvA==',
      ),
    )
  })
})

describe('Structurizr preprocessing', { timeout: 30000 }, () => {
  const remoteBasePath =
    'https://raw.githubusercontent.com/asciidoctor/asciidoctor-kroki/master/'
  const localUnexistingFilePath = 'test/fixtures/structurizr/unexisting.dsl'
  const localExistingFilePath = 'test/fixtures/structurizr/model/person.dsl'
  const diagramTextHead = `
     workspace {
       model {`
  const diagramTextTail = `
        }
        views {
          systemContext s {
            include *
            autolayout lr
          }
        }
      }`

  test('returns original diagramText without "!include ..."', async () => {
    const diagramTextWithoutInclude = `
      ${diagramTextHead}
          u = person "User"
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithoutInclude, {}),
      diagramTextWithoutInclude,
    )
  })

  test('logs and returns original diagramText for unexisting local file referenced with "!include local-file-or-url", because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const diagramTextWithUnexistingLocalIncludeFile = `
      ${diagramTextHead}
          !include ${localUnexistingFilePath}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithUnexistingLocalIncludeFile, {
        logger: memoryLogger,
      }),
      diagramTextWithUnexistingLocalIncludeFile,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.ok(
      logs[0].message.includes(
        `Skipping preprocessing of Structurizr include, because reading the referenced local file '${localUnexistingFilePath}' caused an error:`,
      ),
    )
  })

  test('logs and returns original diagramText for unexisting remote file referenced with "!include remote-url", because it can perhaps be found by kroki server', async () => {
    const memoryLogger = MemoryLogger.create()
    const remoteUnexistingIncludeFilePath = `${remoteBasePath}${localUnexistingFilePath}`
    const diagramTextWithUnexistingRemoteIncludeFile = `
      ${diagramTextHead}
          !include ${remoteUnexistingIncludeFilePath}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithUnexistingRemoteIncludeFile, {
        logger: memoryLogger,
      }),
      diagramTextWithUnexistingRemoteIncludeFile,
    )
    const logs = memoryLogger.getMessages()
    assert.strictEqual(logs.length, 1)
    assert.ok(
      logs[0].message.includes(
        `Skipping preprocessing of Structurizr include, because reading the referenced remote file '${remoteUnexistingIncludeFilePath}' caused an error:`,
      ),
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-or-url"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      ${diagramTextHead}
          !include ${localExistingFilePath}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
${includedText}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText while preserving inline and block comments"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      ${diagramTextHead}
          // !include ${localExistingFilePath}// the whole line is preserved
          # !include ${localExistingFilePath}# the whole line is preserved
          !include ${localExistingFilePath}
          /*
              !include ${localExistingFilePath}
              the whole block is preserved
          */ s = softwareSystem "Software System" /* this also should be preserved */
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
          // !include ${localExistingFilePath}// the whole line is preserved
          # !include ${localExistingFilePath}# the whole line is preserved
${includedText}
          /*
              !include ${localExistingFilePath}
              the whole block is preserved
          */ s = softwareSystem "Software System" /* this also should be preserved */
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText while preserving trailing block comment"', async () => {
    const diagramTextWithExistingLocalIncludeFile = `
      ${diagramTextHead}
          !include ${localExistingFilePath} /*
              this is a trailing block comment
          */
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
${includedText} /*
              this is a trailing block comment
          */
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined local file referenced with "!include local-file-name-with-spaces"', async () => {
    const localExistingFileNameWithSpacesPath =
      'test/fixtures/structurizr/model/person with spaces.dsl'
    const localExistingFileNameWithSpacesPathEscaped =
      localExistingFileNameWithSpacesPath.replace(/ /g, '\\ ')
    const diagramTextWithExistingLocalIncludeFile = `
      ${diagramTextHead}
          !include ${localExistingFileNameWithSpacesPathEscaped}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(
      `${localExistingFileNameWithSpacesPath}`,
      'utf8',
    )
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
${includedText}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithExistingLocalIncludeFile, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined multiple local files referenced with "!include local-file-or-url"', async () => {
    const localExistingFilePath1 =
      'test/fixtures/structurizr/model/software-system.dsl'
    const diagramTextWithExistingLocalIncludeFiles = `
      ${diagramTextHead}
          !include ${localExistingFilePath}
          !include ${localExistingFilePath1}
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
${includedText}
${includedText1}
          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(diagramTextWithExistingLocalIncludeFiles, {}),
      diagramTextWithIncludedText,
    )
  })

  test('returns diagramText with inlined recursive local files referenced with "!include local-file-or-url"', async () => {
    const localExistingFilePath1 =
      'test/fixtures/structurizr/model/software-system.dsl'
    const localExistingFilePath2 =
      'test/fixtures/structurizr/model/person+software-system.dsl'
    const diagramTextWithExistingRecursiveLocalIncludeFile = `
      ${diagramTextHead}
          !include ${localExistingFilePath2}
          u -> s "Uses"
      ${diagramTextTail}`
    const includedText = fs.readFileSync(`${localExistingFilePath}`, 'utf8')
    const includedText1 = fs.readFileSync(`${localExistingFilePath1}`, 'utf8')
    const diagramTextWithIncludedText = `
      ${diagramTextHead}
${includedText}
${includedText1}

          u -> s "Uses"
      ${diagramTextTail}`
    assert.strictEqual(
      await preprocessStructurizr(
        diagramTextWithExistingRecursiveLocalIncludeFile,
        {},
      ),
      diagramTextWithIncludedText,
    )
  })

  test('throws an error for file recursive included itself', async () => {
    const localExistingFileIncludesItselfPath =
      'test/fixtures/structurizr/include/itself.dsl'
    const diagramTextWithIncludeItself = `
      ${diagramTextHead}
          !include ${localExistingFileIncludesItselfPath}
          s = softwareSystem "Software System"
          u -> s "Uses"
      ${diagramTextTail}`
    const errorMessage = `Preprocessing of Structurizr include failed, because recursive reading already included referenced file '${localExistingFileIncludesItselfPath}'`
    await assertRejects(
      () => preprocessStructurizr(diagramTextWithIncludeItself, {}),
      errorMessage,
    )
  })
})
