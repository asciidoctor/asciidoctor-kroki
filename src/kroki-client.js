const pako = require('pako')

const MAX_URI_DEFAULT_VALUE = 4000

module.exports.KrokiDiagram = class KrokiDiagram {
  constructor (type, format, text) {
    this.text = text
    this.type = type
    this.format = format
  }

  getDiagramUri (serverUrl) {
    return `${serverUrl}/${this.type}/${this.format}/${this.encode()}`
  }

  encode () {
    const data = Buffer.from(this.text, 'utf8')
    const compressed = pako.deflate(data, { level: 9 })
    return Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }
}

module.exports.KrokiClient = class KrokiClient {
  constructor (doc, httpClient) {
    const maxUriLengthValue = parseInt(doc.getAttribute('kroki-max-uri-length', String(MAX_URI_DEFAULT_VALUE)))
    this.maxUriLength = isNaN(maxUriLengthValue) ? MAX_URI_DEFAULT_VALUE : maxUriLengthValue
    this.httpClient = httpClient
    const method = doc.getAttribute('kroki-http-method', 'adaptive').toLowerCase()
    if (method === 'get' || method === 'post' || method === 'adaptive') {
      this.method = method
    } else {
      console.warn(`Invalid value '${method}' for kroki-http-method attribute. The value must be either: 'get', 'post' or 'adaptive'. Proceeding using: 'adaptive'.`)
      this.method = 'adaptive'
    }
    this.doc = doc
  }

  getTextContent (krokiDiagram) {
    return this.getImage(krokiDiagram, 'utf8')
  }

  getImage (krokiDiagram, encoding) {
    const serverUrl = this.getServerUrl()
    const type = krokiDiagram.type
    const format = krokiDiagram.format
    const text = krokiDiagram.text
    if (this.method === 'adaptive' || this.method === 'get') {
      const uri = krokiDiagram.getDiagramUri(serverUrl)
      if (uri.length > this.maxUriLength) {
        // The request URI is longer than the max URI length.
        if (this.method === 'get') {
          // The request might be rejected by the server with a 414 Request-URI Too Large.
          // Consider using the attribute kroki-http-method with the value 'adaptive'.
          return this.httpClient.get(uri, encoding)
        }
        return this.httpClient.post(`${serverUrl}/${type}/${format}`, text, encoding)
      }
      return this.httpClient.get(uri, encoding)
    }
    return this.httpClient.post(`${serverUrl}/${type}/${format}`, text, encoding)
  }

  getServerUrl () {
    return this.doc.getAttribute('kroki-server-url') || 'https://kroki.io'
  }
}
