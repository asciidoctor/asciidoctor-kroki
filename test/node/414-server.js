import { createServer } from 'node:http'
import { parentPort } from 'node:worker_threads'

const server = createServer((_req, res) => {
  res.writeHead(414)
  res.end('414 URI Too Long')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
