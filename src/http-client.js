export const DEFAULT_TIMEOUT_MS = 20000
export const DEFAULT_MAX_RESPONSE_SIZE = 25 * 1024 * 1024

/**
 * Options controlling the resource limits of the HTTP client.
 *
 * @typedef {Object} HttpOptions
 * @property {number} [timeout=20000] - Maximum time in milliseconds for a request, including
 *   the time needed to receive the complete response body.
 * @property {number} [maxResponseSize=26214400] - Maximum size in bytes of a response body (25 MiB).
 */

class ResponseTooLargeError extends Error {}

/**
 * Reads the response body incrementally so that no more than `maxResponseSize` bytes
 * are ever accumulated, even when the server omits (or lies about) `Content-Length`.
 */
const readBody = async (response, controller, maxResponseSize) => {
  const reader = response.body?.getReader()
  if (!reader) {
    return new Uint8Array(0)
  }
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxResponseSize) {
      controller.abort()
      await reader.cancel().catch(() => {})
      throw new ResponseTooLargeError()
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const toBinaryString = (bytes) => {
  let data = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    data += String.fromCharCode(bytes[i])
  }
  return data
}

/**
 * Creates an HTTP client that enforces a timeout and a maximum response size.
 * The timeout stays active until the response body has been fully consumed.
 *
 * @param {HttpOptions} [options]
 */
export function createHttpClient({
  timeout = DEFAULT_TIMEOUT_MS,
  maxResponseSize = DEFAULT_MAX_RESPONSE_SIZE,
} = {}) {
  const httpRequest = async (
    uri,
    method,
    headers,
    encoding = 'utf8',
    body,
    expectedContentType,
  ) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(uri, {
        method,
        headers,
        body,
        signal: controller.signal,
      })
      const contentLength = response.headers.get('content-length')
      if (contentLength && Number(contentLength) > maxResponseSize) {
        controller.abort()
        throw new ResponseTooLargeError()
      }
      if (response.ok) {
        if (expectedContentType) {
          const contentType = response.headers.get('content-type') || ''
          if (
            !contentType
              .toLowerCase()
              .startsWith(expectedContentType.toLowerCase())
          ) {
            controller.abort()
            throw new Error(
              `${method} ${uri} - unexpected content-type; expected: ${expectedContentType}, got: ${contentType}`,
            )
          }
        }
        const bytes = await readBody(response, controller, maxResponseSize)
        const data =
          encoding === 'binary'
            ? toBinaryString(bytes)
            : new TextDecoder().decode(bytes)
        if (data !== '') {
          return data
        }
        throw new Error(`${method} ${uri} - server returns an empty response`)
      }
      let errorBody = ''
      if (encoding !== 'binary') {
        try {
          errorBody = new TextDecoder().decode(
            await readBody(response, controller, maxResponseSize),
          )
        } catch (_) {}
      }
      if (response.status === 414) {
        throw new Error(
          `${method} ${uri} - server returns 414 (URI Too Long). The diagram URI is too long for the server. Consider using the 'kroki-http-method' attribute set to 'post' or 'adaptive' to send the diagram source via POST.`,
        )
      }
      throw new Error(
        `${method} ${uri} - server returns ${response.status} status code; response: ${errorBody}`,
      )
    } catch (e) {
      if (e instanceof ResponseTooLargeError) {
        throw new Error(
          `${method} ${uri} - response exceeds maximum size of ${maxResponseSize} bytes`,
        )
      }
      if (e.name === 'AbortError') {
        throw new Error(`${method} ${uri} - timed out after ${timeout}ms`)
      }
      if (e.message?.startsWith(`${method} ${uri} - `)) {
        throw e
      }
      throw new Error(`${method} ${uri} - error; reason: ${e.message}`)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    get: (uri, headers, encoding = 'utf8', expectedContentType) =>
      httpRequest(
        uri,
        'GET',
        headers,
        encoding,
        undefined,
        expectedContentType,
      ),
    post: (uri, body, headers, encoding = 'utf8', expectedContentType) =>
      httpRequest(uri, 'POST', headers, encoding, body, expectedContentType),
  }
}
