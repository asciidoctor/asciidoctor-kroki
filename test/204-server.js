import { parentPort } from 'node:worker_threads'
import { createServer } from 'node:http'

const server = createServer((_req, res) => {
  res.writeHead(204)
  res.end('')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
