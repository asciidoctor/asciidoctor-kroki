const httpRequest = (XMLHttpRequest, uri, method, encoding = 'utf8', body) => {
  let data = ''
  let status = -1
  try {
    const xhr = new XMLHttpRequest()
    xhr.open(method, uri, false)
    if (encoding === 'binary') {
      xhr.responseType = 'arraybuffer'
    }
    xhr.addEventListener('load', function () {
      status = this.status
      if (status === 200) {
        if (encoding === 'binary') {
          const arrayBuffer = xhr.response
          const byteArray = new Uint8Array(arrayBuffer)
          for (let i = 0; i < byteArray.byteLength; i++) {
            data += String.fromCharCode(byteArray[i])
          }
        } else {
          data = this.responseText
        }
      }
    })
    if (body) {
      xhr.send(body)
    } else {
      xhr.send()
    }
  } catch (e) {
    throw new Error(`${method} ${uri} - error; reason: ${e.message}`)
  }
  // assume that no data means it doesn't exist
  if (status === 404 || !data) {
    throw new Error(`${method} ${uri} - server returns an empty response or a 404 status code`)
  }
  return data
}

const httpPost = (XMLHttpRequest, uri, body, encoding = 'utf8') => {
  return httpRequest(XMLHttpRequest, uri, 'POST', encoding, body)
}

const httpGet = (XMLHttpRequest, uri, encoding = 'utf8') => {
  return httpRequest(XMLHttpRequest, uri, 'GET', encoding)
}

module.exports = {
  get: httpGet,
  post: httpPost
}
