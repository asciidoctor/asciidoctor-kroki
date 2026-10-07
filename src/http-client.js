export const DEFAULT_TIMEOUT = 60000
export const DEFAULT_MAX_RESPONSE_SIZE = 25 * 1024 * 1024

/**
 * Resource limits of the HTTP client.
 *
 * @typedef {Object} HttpOptions
 * @property {number} [timeout=60000] - Maximum time in milliseconds for a request,
 *   including the time needed to receive the complete response body.
 * @property {number} [maxResponseSize=26214400] - Maximum size in bytes of a response body (25 MiB).
 */

class ResponseTooLargeError extends Error {}

/**
 * Reads the response body incrementally so that no more than `maxResponseSize` bytes
 * are ever accumulated, even when the server omits (or lies about) `Content-Length`.
 */
const readBody = async (response, maxResponseSize) => {
  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxResponseSize) {
    throw new ResponseTooLargeError()
  }
  if (!response.body) {
    return new Uint8Array(0)
  }
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxResponseSize) {
      throw new ResponseTooLargeError()
    }
    chunks.push(value)
  }
  const byteArray = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    byteArray.set(chunk, offset)
    offset += chunk.byteLength
  }
  return byteArray
}

const httpRequest = async (
  uri,
  method,
  headers,
  encoding = 'utf8',
  body,
  expectedContentType,
  { signal, maxResponseSize },
) => {
  let response
  try {
    response = await fetch(uri, { method, headers, body, signal })
  } catch (e) {
    if (signal.aborted) {
      throw e
    }
    throw new Error(`${method} ${uri} - error; reason: ${e.message}`)
  }
  if (response.ok) {
    if (expectedContentType) {
      const contentType = response.headers.get('content-type') || ''
      if (
        !contentType.toLowerCase().startsWith(expectedContentType.toLowerCase())
      ) {
        throw new Error(
          `${method} ${uri} - unexpected content-type; expected: ${expectedContentType}, got: ${contentType}`,
        )
      }
    }
    const byteArray = await readBody(response, maxResponseSize)
    if (encoding === 'binary') {
      let data = ''
      for (let i = 0; i < byteArray.byteLength; i++) {
        data += String.fromCharCode(byteArray[i])
      }
      if (data !== '') {
        return data
      }
      throw new Error(`${method} ${uri} - server returns an empty response`)
    }
    const data = new TextDecoder().decode(byteArray)
    if (data !== '') {
      return data
    }
    throw new Error(`${method} ${uri} - server returns an empty response`)
  }
  let errorBody = ''
  if (encoding !== 'binary') {
    try {
      errorBody = new TextDecoder().decode(
        await readBody(response, maxResponseSize),
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
}

/**
 * Creates an HTTP client that enforces a timeout (until the response body is fully received)
 * and a maximum response size.
 *
 * @param {HttpOptions} [options]
 */
export function createHttpClient({
  timeout = DEFAULT_TIMEOUT,
  maxResponseSize = DEFAULT_MAX_RESPONSE_SIZE,
} = {}) {
  const request = async (uri, method, headers, encoding, body, contentType) => {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    try {
      return await httpRequest(
        uri,
        method,
        headers,
        encoding,
        body,
        contentType,
        { signal: controller.signal, maxResponseSize },
      )
    } catch (e) {
      if (e instanceof ResponseTooLargeError) {
        throw new Error(
          `${method} ${uri} - response exceeds maximum size of ${maxResponseSize} bytes`,
        )
      }
      if (timedOut && e.name === 'AbortError') {
        throw new Error(`${method} ${uri} - timed out after ${timeout}ms`)
      }
      throw e
    } finally {
      clearTimeout(timer)
      // releases the connection when the response body was not (fully) consumed
      controller.abort()
    }
  }
  return {
    get: (uri, headers, encoding = 'utf8', expectedContentType) =>
      request(uri, 'GET', headers, encoding, undefined, expectedContentType),
    post: (uri, body, headers, encoding = 'utf8', expectedContentType) =>
      request(uri, 'POST', headers, encoding, body, expectedContentType),
  }
}

export default createHttpClient()
