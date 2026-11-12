/**
 * Why an HTTP request failed:
 * - `network`: the server couldn't be reached (connection refused, unknown host, TLS error...);
 * - `timeout`: the complete response wasn't received in time;
 * - `http`: the server answered with a non-2xx status;
 * - `unexpected-response`: the server answered with a 2xx status, but an unexpected content type or an empty body;
 * - `size-limit`: the response exceeds the maximum size.
 *
 * @typedef {'network'|'timeout'|'http'|'unexpected-response'|'size-limit'} HttpErrorType
 */

/**
 * Error raised when an HTTP request fails, for instance a request to the Kroki server.
 * The message has the form `<method> <url> - <reason>`.
 */
export class HttpError extends Error {
  /**
   * @param {HttpErrorType} type - Why the request failed.
   * @param {string} method - HTTP method of the request.
   * @param {string} url - URL identifying the request (for a Kroki GET request, without the encoded diagram).
   * @param {string} reason - Description of the failure, without the method and the URL.
   * @param {Object} [details]
   * @param {number} [details.status] - HTTP status of the response, when there is one.
   * @param {string} [details.serverMessage] - Reason returned by the server, when there is one.
   * @param {unknown} [details.cause] - Underlying error.
   */
  constructor(
    type,
    method,
    url,
    reason,
    { status, serverMessage, cause } = {},
  ) {
    super(
      `${method} ${url} - ${reason}`,
      cause === undefined ? undefined : { cause },
    )
    this.name = 'HttpError'
    /** @type {HttpErrorType} */
    this.type = type
    this.method = method
    this.url = url
    this.reason = reason
    /** @type {number|undefined} */
    this.status = status
    /** @type {string|undefined} */
    this.serverMessage = serverMessage
  }

  /**
   * Returns a copy of this error that identifies the request by another URL.
   *
   * @param {string} url - URL identifying the request.
   * @returns {HttpError}
   */
  withUrl(url) {
    return new HttpError(this.type, this.method, url, this.reason, {
      status: this.status,
      serverMessage: this.serverMessage,
      cause: this.cause,
    })
  }
}

/**
 * Returns the reason contained in the body of an error response.
 * The Kroki server answers `{"error": {"code": 400, "message": "..."}}` when the request accepts
 * `application/json`; any other body (an older server, a proxy) is returned as is.
 *
 * @param {string} body - Body of the response.
 * @param {string} contentType - Content type of the response.
 * @returns {string|undefined} The reason, or `undefined` when the body is empty.
 */
export const serverMessageOf = (body, contentType) => {
  if (contentType.toLowerCase().startsWith('application/json')) {
    try {
      const message = JSON.parse(body)?.error?.message
      if (typeof message === 'string' && message !== '') {
        return message
      }
    } catch (_) {
      // not the JSON returned by Kroki, fall back to the raw body
    }
  }
  const trimmed = body.trim()
  return trimmed === '' ? undefined : trimmed
}
