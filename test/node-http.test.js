import { describe, it } from 'node:test'
import assert from 'node:assert'
import httpClient from '../src/http/node-http.js'
import { Worker } from 'node:worker_threads'
import ospath, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

describe('Synchronous HTTP client (unxhr)', () => {
  it('should return throw error when the server returns a 500', async () => {
    const { worker, port } = await startServer('500-server.js')
    try {
      httpClient.get(`http://localhost:${port}`, {}, 'utf8')
      assert.fail('it should throw an error when the server returns a 500')
    } catch (err) {
      // it should include the response from the server in the error message
      assert.ok(err.message.includes('500 Something went bad!'))
    } finally {
      await worker.terminate()
    }
  })
  it('should return throw an error when the server returns an empty response', async () => {
    const { worker, port } = await startServer('204-server.js')
    try {
      httpClient.get(`http://localhost:${port}`, {}, 'utf8')
      assert.fail(
        'it should throw an error when the server returns an empty response',
      )
    } catch (err) {
      assert.ok(err.message.includes('server returns an empty response'))
    } finally {
      await worker.terminate()
    }
  })
})
