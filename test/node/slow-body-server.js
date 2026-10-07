import { createServer } from 'node:http'
import { parentPort } from 'node:worker_threads'

// Sends the headers immediately, then drips the body forever.
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.write('x')
  const interval = setInterval(() => res.write('x'), 50)
  res.on('close', () => clearInterval(interval))
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
