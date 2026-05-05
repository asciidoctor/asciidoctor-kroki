import assert from 'node:assert'
import ospath, { dirname } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import httpClient from '../../src/http/http-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * @returns {Promise<{}>}
 */
async function startServer(name) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(ospath.join(__dirname, name))
    worker.on('message', (msg) => {
      resolve({
        worker,
        port: msg.port,
      })
    })
    worker.on('error', reject)
  })
}

describe('Async HTTP client (fetch)', () => {
  test('rejects with an error message containing the status code on HTTP 500', async () => {
    const { worker, port } = await startServer('500-server.js')
    try {
      await assert.rejects(
        () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
        (err) => {
          assert.ok(err.message.includes('500'), err.message)
          return true
        },
      )
    } finally {
      await worker.terminate()
    }
  })
  test('rejects with "server returns an empty response" on HTTP 204', async () => {
    const { worker, port } = await startServer('204-server.js')
    try {
      await assert.rejects(
        () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
        (err) => {
          assert.ok(
            err.message.includes('server returns an empty response'),
            err.message,
          )
          return true
        },
      )
    } finally {
      await worker.terminate()
    }
  })
})
