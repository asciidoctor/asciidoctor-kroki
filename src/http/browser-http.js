/* global XMLHttpRequest */
import httpClient from './http-client.js'

const httpPost = (uri, body, headers, encoding = 'utf8') =>
  httpClient.post(XMLHttpRequest, uri, body, headers, encoding)
const httpGet = (uri, headers, encoding = 'utf8') =>
  httpClient.get(XMLHttpRequest, uri, headers, encoding)

export default {
  get: httpGet,
  post: httpPost,
}
