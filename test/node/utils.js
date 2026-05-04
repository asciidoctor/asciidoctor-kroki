import assert from 'node:assert'
import fs from 'node:fs'
import { dirname, posix as ospath } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Until recursive: true is a stable part of Node
// See: https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
export function deleteDirWithFiles(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const curPath = ospath.join(path, file)
      fs.unlinkSync(curPath)
    })
    fs.rmdirSync(path)
  }
}

export function fixturePath(...paths) {
  return ospath.join(__dirname, '..', 'fixtures', ...paths)
}

export function readFixture(...paths) {
  return fs.readFileSync(ospath.join(__dirname, '..', 'fixtures', ...paths), 'utf-8')
}

export function assertContains(actual, expected) {
  assert.ok(
    actual.includes(expected),
    `Expected:\n${actual}\n\nTo contain:\n${expected}`,
  )
}

export function assertNotContains(actual, unexpected) {
  assert.ok(
    !actual.includes(unexpected),
    `Expected:\n${actual}\n\nNot to contain:\n${unexpected}`,
  )
}
