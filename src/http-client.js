// Guards against a misbehaving or malicious Kroki server causing a hang (slow/no
// response) or memory exhaustion (unbounded response body) that would block the
// build pipeline.
const REQUEST_TIMEOUT_MS = 20000
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024

const httpRequest = async (
  uri,
  method,
  headers,
  encoding = 'utf8',
  body,
  expectedContentType,
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response
  try {
    response = await fetch(uri, { method, headers, body, signal: controller.signal })
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`${method} ${uri} - timed out after ${REQUEST_TIMEOUT_MS}ms`)
    }
    throw new Error(`${method} ${uri} - error; reason: ${e.message}`)
  } finally {
    clearTimeout(timeout)
  }
  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error(
      `${method} ${uri} - response too large (${contentLength} bytes, max ${MAX_RESPONSE_BYTES})`,
    )
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
    if (encoding === 'binary') {
      const arrayBuffer = await response.arrayBuffer()
      const byteArray = new Uint8Array(arrayBuffer)
      let data = ''
      for (let i = 0; i < byteArray.byteLength; i++) {
        data += String.fromCharCode(byteArray[i])
      }
      if (data !== '') {
        return data
      }
      throw new Error(`${method} ${uri} - server returns an empty response`)
    }
    const data = await response.text()
    if (data !== '') {
      return data
    }
    throw new Error(`${method} ${uri} - server returns an empty response`)
  }
  let errorBody = ''
  if (encoding !== 'binary') {
    try {
      errorBody = await response.text()
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

export default {
  get: (uri, headers, encoding = 'utf8', expectedContentType) =>
    httpRequest(uri, 'GET', headers, encoding, undefined, expectedContentType),
  post: (uri, body, headers, encoding = 'utf8', expectedContentType) =>
    httpRequest(uri, 'POST', headers, encoding, body, expectedContentType),
}
