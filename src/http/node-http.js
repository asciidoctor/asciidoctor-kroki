const XMLHttpRequest = require('unxhr').XMLHttpRequest
const httpClient = require('./http-client.js')

const httpPost = (uri, body, encoding = 'utf8') => httpClient.post(XMLHttpRequest, uri, body, encoding)
const httpGet = (uri, encoding = 'utf8') => httpClient.get(XMLHttpRequest, uri, encoding)

module.exports = {
  get: httpGet,
  post: httpPost
}
