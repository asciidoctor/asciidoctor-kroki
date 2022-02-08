import ospath from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = ospath.dirname(fileURLToPath(import.meta.url))

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

export const fixturePath = (...paths) => ospath.join(__dirname, 'fixtures', ...paths)

export const readFixture = (...paths) => fs.readFileSync(ospath.join(__dirname, 'fixtures', ...paths), 'utf-8')
