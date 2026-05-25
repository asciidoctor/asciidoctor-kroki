const httpRequest = async (
  uri,
  method,
  headers,
  encoding = 'utf8',
  body,
  expectedContentType,
) => {
  let response
  try {
    response = await fetch(uri, { method, headers, body })
  } catch (e) {
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
