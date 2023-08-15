const httpRequest = (XMLHttpRequest, uri, method, headers, encoding = 'utf8', body) => {
  let data = ''
  let status = -1
  try {
    const xhr = new XMLHttpRequest()
    xhr.open(method, uri, false)
    for (const [name, value] in Object.entries(headers)) {
      xhr.setRequestHeader(name, value)
    }
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
      } else if (encoding !== 'binary') {
        data = this.responseText
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
  if (status >= 200 && status < 400) {
    // successful status
    if (data) {
      return data
    }
    throw new Error(`${method} ${uri} - server returns an empty response`)
  }

  throw new Error(`${method} ${uri} - server returns ${status} status code; response: ${data}`)
}

const httpPost = (XMLHttpRequest, uri, body, headers, encoding = 'utf8') => {
  return httpRequest(XMLHttpRequest, uri, 'POST', headers, encoding, body)
}

const httpGet = (XMLHttpRequest, uri, headers, encoding = 'utf8') => {
  return httpRequest(XMLHttpRequest, uri, 'GET', headers, encoding)
}

module.exports = {
  get: httpGet,
  post: httpPost
}
