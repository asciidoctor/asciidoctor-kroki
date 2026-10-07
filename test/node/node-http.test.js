import assert from 'node:assert'
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
import httpClient, { createHttpClient } from '../../src/http-client.js'
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
            attributes: { 'kroki-server-url': `http://localhost:${port}` },
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
