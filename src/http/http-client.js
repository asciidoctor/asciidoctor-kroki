const httpRequest = async (uri, method, headers, encoding = 'utf8', body) => {
  let response
  try {
    response = await fetch(uri, { method, headers, body })
  } catch (e) {
    throw new Error(`${method} ${uri} - error; reason: ${e.message}`)
  }
  if (response.ok) {
    if (encoding === 'binary') {
      const arrayBuffer = await response.arrayBuffer()
      const byteArray = new Uint8Array(arrayBuffer)
      let data = ''
      for (let i = 0; i < byteArray.byteLength; i++) {
        data += String.fromCharCode(byteArray[i])
      }
      if (data) {
        return data
      }
      throw new Error(`${method} ${uri} - server returns an empty response`)
    }
    const data = await response.text()
    if (data) {
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
  throw new Error(
    `${method} ${uri} - server returns ${response.status} status code; response: ${errorBody}`,
  )
}

export default {
  get: (uri, headers, encoding = 'utf8') =>
    httpRequest(uri, 'GET', headers, encoding),
  post: (uri, body, headers, encoding = 'utf8') =>
    httpRequest(uri, 'POST', headers, encoding, body),
}
