import { createServer } from 'node:http'
import { parentPort, workerData } from 'node:worker_threads'

// Streams `workerData.size` bytes using chunked transfer encoding (no Content-Length).
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  const chunk = Buffer.alloc(1024, 'x')
  let remaining = workerData.size
  const writeMore = () => {
    while (remaining > 0) {
      const next = chunk.subarray(0, Math.min(chunk.length, remaining))
      remaining -= next.length
      if (!res.write(next)) {
        res.once('drain', writeMore)
        return
      }
    }
    res.end()
  }
  res.on('error', () => {})
  writeMore()
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
