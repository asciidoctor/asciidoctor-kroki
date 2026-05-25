import { createServer } from 'node:http'
import { parentPort } from 'node:worker_threads'

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<html><body>Not a diagram</body></html>')
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})