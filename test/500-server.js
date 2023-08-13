const { parentPort } = require('node:worker_threads')
const { createServer } = require('node:http')

const server = createServer(function (req, res) {
  res.writeHead(500)
  res.end('500 Something went bad!')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
