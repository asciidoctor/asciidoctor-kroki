const { parentPort } = require('node:worker_threads')
const { createServer } = require('node:http')

const server = createServer(function (req, res) {
  res.writeHead(204)
  res.end('')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
