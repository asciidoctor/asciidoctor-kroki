import { createServer } from 'node:http'
import { parentPort } from 'node:worker_threads'

// Answers like a Kroki server when the request accepts application/json.
const server = createServer((_req, res) => {
  res.writeHead(400, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      error: {
        code: 400,
        message: 'Syntax Error? (Assumed diagram type: sequence) (line: 2)',
      },
    }),
  )
})
server.listen(0, 'localhost', () => {
  parentPort.postMessage({ port: server.address().port })
})
