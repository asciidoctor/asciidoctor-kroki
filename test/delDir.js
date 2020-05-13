// Until recursive: true is a stable part of Node
// See: https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty

const fs = require('fs')
const Path = require('path')

module.exports.deleteDirWithFiles = function (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const curPath = Path.join(path, file)
      fs.unlinkSync(curPath)
    })
    fs.rmdirSync(path)
  }
}
