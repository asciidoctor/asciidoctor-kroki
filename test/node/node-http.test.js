import assert from 'node:assert'
import { createServer } from 'node:net'
import ospath, { dirname } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import {
  convert,
  Extensions,
  LoggerManager,
  MemoryLogger,
} from '@asciidoctor/core'
import httpClient, {
  createHttpClient,
  HttpError,
  networkErrorReason,
} from '../../src/http-client.js'
import { serverMessageOf } from '../../src/http-error.js'
import { register } from '../../src/index.js'
import { createNodeFs } from '../../src/node-fs.js'

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
  test('includes the response body on HTTP 500 when a binary response is requested', async () => {
    const { worker, port } = await startServer('500-server.js')
    try {
      await assert.rejects(
        () => httpClient.get(`http://localhost:${port}`, {}, 'binary'),
        (err) => {
          assert.ok(
            err.message.includes('response: 500 Something went bad!'),
            err.message,
          )
          return true
        },
      )
    } finally {
      await worker.terminate()
    }
  })
  test('includes the cause of a network error', async () => {
    // a port on which nothing listens
    const server = createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    await new Promise((resolve) => server.close(resolve))
    await assert.rejects(
      () => httpClient.get(`http://127.0.0.1:${port}`, {}, 'utf8'),
      (err) => {
        assert.ok(err.message.includes('ECONNREFUSED'), err.message)
        assert.ok(!err.message.includes('fetch failed'), err.message)
        return true
      },
    )
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

  describe('structured errors', () => {
    const rejectsWith = async (fn, expected) =>
      assert.rejects(fn, (err) => {
        assert.ok(err instanceof HttpError, String(err))
        for (const [key, value] of Object.entries(expected)) {
          assert.strictEqual(err[key], value, `${key}: ${err.message}`)
        }
        return true
      })

    test('uses the message of a JSON error returned by Kroki as the server message', async () => {
      const { worker, port } = await startServer('400-json-server.js')
      const url = `http://localhost:${port}/plantuml/png`
      try {
        await rejectsWith(() => httpClient.post(url, 'x', {}, 'binary'), {
          type: 'http',
          method: 'POST',
          url,
          status: 400,
          serverMessage:
            'Syntax Error? (Assumed diagram type: sequence) (line: 2)',
          message: `POST ${url} - server returns 400 status code; response: Syntax Error? (Assumed diagram type: sequence) (line: 2)`,
        })
      } finally {
        await worker.terminate()
      }
    })
    test('uses the raw body as the server message when it is not JSON', async () => {
      const { worker, port } = await startServer('500-server.js')
      try {
        await rejectsWith(
          () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
          {
            type: 'http',
            status: 500,
            serverMessage: '500 Something went bad!',
          },
        )
      } finally {
        await worker.terminate()
      }
    })
    test('has the http type and the status on HTTP 414', async () => {
      const { worker, port } = await startServer('414-server.js')
      try {
        await rejectsWith(
          () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
          { type: 'http', status: 414, serverMessage: '414 URI Too Long' },
        )
      } finally {
        await worker.terminate()
      }
    })
    test('has the unexpected-response type on an empty response', async () => {
      const { worker, port } = await startServer('204-server.js')
      try {
        await rejectsWith(
          () => httpClient.get(`http://localhost:${port}`, {}, 'utf8'),
          { type: 'unexpected-response', status: 204 },
        )
      } finally {
        await worker.terminate()
      }
    })
    test('has the unexpected-response type on an unexpected content type', async () => {
      const { worker, port } = await startServer('200-html-server.js')
      try {
        await rejectsWith(
          () =>
            httpClient.get(
              `http://localhost:${port}`,
              {},
              'utf8',
              'image/svg+xml',
            ),
          { type: 'unexpected-response', status: 200 },
        )
      } finally {
        await worker.terminate()
      }
    })
    test('has the network type and keeps the cause of a network error', async () => {
      const server = createServer()
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const { port } = server.address()
      await new Promise((resolve) => server.close(resolve))
      await assert.rejects(
        () => httpClient.get(`http://127.0.0.1:${port}`, {}, 'utf8'),
        (err) => {
          assert.ok(err instanceof HttpError, String(err))
          assert.strictEqual(err.type, 'network')
          assert.strictEqual(err.status, undefined)
          assert.ok(err.cause, 'the error has a cause')
          return true
        },
      )
    })
    test('has the timeout type when the response is not received in time', async () => {
      const { worker, port } = await startServer('slow-body-server.js')
      try {
        await rejectsWith(
          () =>
            createHttpClient({ timeout: 300 }).get(
              `http://localhost:${port}`,
              {},
              'utf8',
            ),
          { type: 'timeout' },
        )
      } finally {
        await worker.terminate()
      }
    })
    test('has the size-limit type when the response is too large', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 2048 },
      )
      try {
        await rejectsWith(
          () =>
            createHttpClient({ maxResponseSize: 1024 }).get(
              `http://localhost:${port}`,
              {},
              'utf8',
            ),
          { type: 'size-limit' },
        )
      } finally {
        await worker.terminate()
      }
    })
  })

  describe('server message', () => {
    test('extracts the message of a Kroki JSON error', () => {
      assert.strictEqual(
        serverMessageOf(
          '{"error":{"code":400,"message":"Unsupported output format"}}',
          'application/json',
        ),
        'Unsupported output format',
      )
    })
    test('returns the trimmed body when it is not JSON', () => {
      assert.strictEqual(
        serverMessageOf('Error 400: Syntax Error?\n', 'text/plain'),
        'Error 400: Syntax Error?',
      )
    })
    test('returns the body of an invalid or unexpected JSON response', () => {
      assert.strictEqual(
        serverMessageOf('{"message":"nope"}', 'application/json'),
        '{"message":"nope"}',
      )
      assert.strictEqual(
        serverMessageOf('<html>', 'application/json; charset=utf-8'),
        '<html>',
      )
    })
    test('returns undefined for an empty body', () => {
      assert.strictEqual(serverMessageOf('  ', 'text/plain'), undefined)
    })
  })

  describe('network error reason', () => {
    test('uses the message of the cause', () => {
      const cause = Object.assign(
        new Error('getaddrinfo ENOTFOUND example.invalid'),
        { code: 'ENOTFOUND' },
      )
      assert.strictEqual(
        networkErrorReason(new TypeError('fetch failed', { cause })),
        'getaddrinfo ENOTFOUND example.invalid',
      )
    })
    test('adds the code of the cause when the message does not contain it', () => {
      const cause = Object.assign(new Error('certificate has expired'), {
        code: 'CERT_HAS_EXPIRED',
      })
      assert.strictEqual(
        networkErrorReason(new TypeError('fetch failed', { cause })),
        'certificate has expired (CERT_HAS_EXPIRED)',
      )
    })
    test('uses the messages of an AggregateError cause', () => {
      const cause = Object.assign(
        new AggregateError([
          new Error('connect ECONNREFUSED ::1:8000'),
          new Error('connect ECONNREFUSED 127.0.0.1:8000'),
        ]),
        { code: 'ECONNREFUSED' },
      )
      assert.strictEqual(
        networkErrorReason(new TypeError('fetch failed', { cause })),
        'connect ECONNREFUSED ::1:8000, connect ECONNREFUSED 127.0.0.1:8000',
      )
    })
    test('uses the message of the error when there is no cause', () => {
      assert.strictEqual(
        networkErrorReason(new TypeError('Failed to fetch')),
        'Failed to fetch',
      )
    })
  })

  describe('resource limits', () => {
    test('times out when the body is still being received after the timeout', async () => {
      const { worker, port } = await startServer('slow-body-server.js')
      try {
        const client = createHttpClient({ timeout: 300 })
        await assert.rejects(
          () => client.get(`http://localhost:${port}`, {}, 'utf8'),
          /timed out after 300ms/,
        )
      } finally {
        await worker.terminate()
      }
    })

    test('rejects a chunked response (without Content-Length) that exceeds the maximum size', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 10 * 1024 + 1 },
      )
      try {
        const client = createHttpClient({ maxResponseSize: 10 * 1024 })
        await assert.rejects(
          () => client.get(`http://localhost:${port}`, {}, 'utf8'),
          /response exceeds maximum size of 10240 bytes/,
        )
      } finally {
        await worker.terminate()
      }
    })

    test('accepts a chunked response of exactly the maximum size', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 10 * 1024 },
      )
      try {
        const client = createHttpClient({ maxResponseSize: 10 * 1024 })
        const data = await client.get(`http://localhost:${port}`, {}, 'utf8')
        assert.strictEqual(data.length, 10 * 1024)
      } finally {
        await worker.terminate()
      }
    })

    test('applies the limits to remote reads of the Node.js VFS', async () => {
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 2048 },
      )
      try {
        const nodeFs = createNodeFs(createHttpClient({ maxResponseSize: 1024 }))
        await assert.rejects(
          () => nodeFs.read(`http://localhost:${port}`),
          /response exceeds maximum size of 1024 bytes/,
        )
      } finally {
        await worker.terminate()
      }
    })

    test('register() applies context.http to Kroki requests and remote includes', async () => {
      // the same server stands for the Kroki server and the remote include
      const { worker, port } = await startServer(
        'oversized-chunked-server.js',
        { size: 2048 },
      )
      const defaultLogger = LoggerManager.getLogger()
      const memoryLogger = MemoryLogger.create()
      try {
        LoggerManager.setLogger(memoryLogger)
        const registry = Extensions.create()
        register(registry, { http: { maxResponseSize: 1024 } })
        const html = await convert(
          `[plantuml,format=txt]\n----\n!include http://localhost:${port}/style.puml\nalice -> bob\n----`,
          {
            safe: 'safe',
            extension_registry: registry,
            attributes: {
              'kroki-server-url': `http://localhost:${port}`,
              'allow-uri-read': '',
            },
          },
        )
        // a message with a source location is an object
        const messages = memoryLogger
          .getMessages()
          .map(({ message }) => message.text ?? message)
        assert.ok(
          messages.some(
            (m) =>
              m.includes(`http://localhost:${port}/style.puml`) &&
              m.includes('response exceeds maximum size of 1024 bytes'),
          ),
          messages.join('\n'),
        )
        assert.ok(
          messages.some(
            (m) =>
              m.includes(`http://localhost:${port}/plantuml/txt`) &&
              m.includes('response exceeds maximum size of 1024 bytes'),
          ),
          messages.join('\n'),
        )
        assert.ok(html.includes('kroki-error'), html)
      } finally {
        LoggerManager.setLogger(defaultLogger)
        await worker.terminate()
      }
    })
  })
})
