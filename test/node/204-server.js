import { createServer } from 'node:http'
import { parentPort } from 'node:worker_threads'

const server = createServer((_req, res) => {
  res.writeHead(204)
  res.end('')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
