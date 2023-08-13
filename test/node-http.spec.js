/* global describe it */
const httpClient = require('../src/http/node-http.js')
const { Worker } = require('node:worker_threads')
const ospath = require('node:path')
const chai = require('chai')
const expect = chai.expect

/**
 * @returns {Promise<{}>}
 */
async function startServer (name) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(ospath.join(__dirname, name))
    worker.on('message', (msg) => {
      resolve({
        worker,
        port: msg.port
      })
    })
    worker.on('error', reject)
  })
}

describe('Synchronous HTTP client (unxhr)', function () {
  it('should return throw error when the server returns a 500', async () => {
    const { worker, port } = await startServer('500-server.js')
    try {
      httpClient.get(`http://localhost:${port}`, {}, 'utf8')
      expect.fail('it should throw an error when the server returns a 500')
    } catch (err) {
      // it should include the response from the server in the error message
      expect(err.message).to.contains('500 Something went bad!')
    } finally {
      await worker.terminate()
    }
  })
  it('should return throw an error when the server returns an empty response', async () => {
    const { worker, port } = await startServer('204-server.js')
    try {
      httpClient.get(`http://localhost:${port}`, {}, 'utf8')
      expect.fail('it should throw an error when the server returns an empty response')
    } catch (err) {
      expect(err.message).to.contains('server returns an empty response')
    } finally {
      await worker.terminate()
    }
  })
})
