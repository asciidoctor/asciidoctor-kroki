const ospath = require('path')
const fs = require('fs')
const Path = require('path')

module.exports = {
  // Until recursive: true is a stable part of Node
  // See: https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
  deleteDirWithFiles: function (path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = Path.join(path, file)
        fs.unlinkSync(curPath)
      })
      fs.rmdirSync(path)
    }
  },
  fixturePath: (...paths) => ospath.join(__dirname, 'fixtures', ...paths),
  readFixture: (...paths) => fs.readFileSync(ospath.join(__dirname, 'fixtures', ...paths), 'utf-8')
}
