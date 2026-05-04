import { dirname, posix as ospath } from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Until recursive: true is a stable part of Node
// See: https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
export function deleteDirWithFiles (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const curPath = ospath.join(path, file)
      fs.unlinkSync(curPath)
    })
    fs.rmdirSync(path)
  }
}

export function fixturePath (...paths) {
  return ospath.join(__dirname, 'fixtures', ...paths)
}

export function readFixture (...paths) {
  return fs.readFileSync(ospath.join(__dirname, 'fixtures', ...paths), 'utf-8')
}
