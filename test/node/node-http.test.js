import assert from 'node:assert'
import ospath, { dirname } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { convert, Extensions } from '@asciidoctor/core'
import {
  createHttpClient,
  DEFAULT_MAX_RESPONSE_SIZE,
  DEFAULT_TIMEOUT_MS,
} from '../../src/http-client.js'

import { register } from '../../src/index.js'
import { createNodeFs } from '../../src/node-fs.js'

const httpClient = createHttpClient()

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * @returns {Promise<{}>}
 */
async function startServer(name, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(ospath.join(__dirname, name), { workerData })
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
  test('rejects with actionable message on HTTP 414', async () => {
    const { worker, port } = await startServer('414-server.js')
    try {
      await assert.rejects(
        () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
        (err) => {
          assert.ok(err.message.includes('414'), err.message)
          assert.ok(err.message.includes('kroki-http-method'), err.message)
          return true
        },
      )
    } finally {
      await worker.terminate()
    }
  })
  test('rejects with "unexpected content-type" when server returns wrong content-type', async () => {
    const { worker, port } = await startServer('200-html-server.js')
    try {
      await assert.rejects(
        () =>
          httpClient.get(
            `http://localhost:${port}`,
            {},
            'utf8',
            'image/svg+xml',
          ),
        (err) => {
          assert.ok(
            err.message.includes('unexpected content-type'),
            err.message,
          )
          assert.ok(err.message.includes('image/svg+xml'), err.message)
          assert.ok(err.message.includes('text/html'), err.message)
          return true
        },
      )
    } finally {
      await worker.terminate()
    }
  })

  describe('resource limits', () => {
    test('uses a 20s timeout and a 25 MiB maximum response size by default', () => {
      assert.strictEqual(DEFAULT_TIMEOUT_MS, 20000)
      assert.strictEqual(DEFAULT_MAX_RESPONSE_SIZE, 25 * 1024 * 1024)
    })

    test('times out when the body is still being received after the timeout', async () => {
      const { worker, port } = await startServer('slow-body-server.js')
      try {
        const client = createHttpClient({ timeout: 300 })
        await assert.rejects(
          () => client.get(`http://localhost:${port}`, {}, 'utf8'),
          (err) => {
            assert.ok(
              err.message.includes('timed out after 300ms'),
              err.message,
            )
            return true
          },
        )
      } finally {
        await worker.terminate()
      }
    })

    test('rejects a chunked response without Content-Length that exceeds the maximum size', async () => {
      const maxResponseSize = 10 * 1024
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        {
          size: maxResponseSize + 1,
        },
      )
      try {
        const client = createHttpClient({ maxResponseSize })
        await assert.rejects(
          () => client.get(`http://localhost:${port}`, {}, 'utf8'),
          (err) => {
            assert.ok(
              err.message.includes(
                `response exceeds maximum size of ${maxResponseSize} bytes`,
              ),
              err.message,
            )
            return true
          },
        )
      } finally {
        await worker.terminate()
      }
    })

    test('accepts a chunked response of exactly the maximum size', async () => {
      const maxResponseSize = 10 * 1024
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        {
          size: maxResponseSize,
        },
      )
      try {
        const client = createHttpClient({ maxResponseSize })
        const data = await client.get(`http://localhost:${port}`, {}, 'utf8')
        assert.strictEqual(data.length, maxResponseSize)
      } finally {
        await worker.terminate()
      }
    })

    test('applies the configured limits to remote includes read through the Node.js VFS', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        {
          size: 2048,
        },
      )
      try {
        const limited = createNodeFs(
          createHttpClient({ maxResponseSize: 1024 }),
        )
        await assert.rejects(
          () => limited.read(`http://localhost:${port}`),
          /response exceeds maximum size of 1024 bytes/,
        )
        const unlimited = createNodeFs(createHttpClient())
        assert.strictEqual(
          (await unlimited.read(`http://localhost:${port}`)).length,
          2048,
        )
      } finally {
        await worker.terminate()
      }
    })

    test('register() passes context.http to the client used for remote data files', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 2048 },
      )
      try {
        const input = `[vegalite]\n----\n{"data":{"url":"http://localhost:${port}/data.csv"},"mark":"bar"}\n----`
        const render = async (context) => {
          const registry = Extensions.create()
          register(registry, context)
          return convert(input, { safe: 'safe', extension_registry: registry })
        }
        // when the remote file exceeds the limit, preprocessing is skipped (left to Kroki)
        const limited = await render({ http: { maxResponseSize: 1024 } })
        const unlimited = await render({})
        assert.notStrictEqual(limited, unlimited)
      } finally {
        await worker.terminate()
      }
    })
  })
})
