const XMLHttpRequest = require('unxhr').XMLHttpRequest
const httpClient = require('./http-client.js')

const httpPost = (uri, body, headers, encoding = 'utf8') => httpClient.post(XMLHttpRequest, uri, body, headers, encoding)
const httpGet = (uri, headers, encoding = 'utf8') => httpClient.get(XMLHttpRequest, uri, headers, encoding)

module.exports = {
  get: httpGet,
  post: httpPost
}
