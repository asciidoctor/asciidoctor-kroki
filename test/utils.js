const ospath = require('path').posix
const fs = require('fs')

module.exports = {
  // Until recursive: true is a stable part of Node
  // See: https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
  deleteDirWithFiles: function (path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = ospath.join(path, file)
        fs.unlinkSync(curPath)
      })
      fs.rmdirSync(path)
    }
  },
  fixturePath: (...paths) => ospath.join(__dirname, 'fixtures', ...paths),
  readFixture: (...paths) => fs.readFileSync(ospath.join(__dirname, 'fixtures', ...paths), 'utf-8')
}
