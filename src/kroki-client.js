import pako from 'pako'
import packageJson from '../package.json' with { type: 'json' }

/** @type {number} Default maximum URI length before switching to POST. */
const MAX_URI_DEFAULT_VALUE = 4000

/** @type {Object<string, string>} Maps diagram output format to its expected MIME type. */
const MIME_TYPES = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  txt: 'text/plain',
  atxt: 'text/plain',
  utxt: 'text/plain',
  base64: 'text/plain',
}

/** @type {string} Referer header value sent with every request. */
const REFERER = `asciidoctor/kroki.js/${packageJson.version}`

/**
 * Represents a Kroki diagram, holding its type, output format, source text, and rendering options.
 */
export class KrokiDiagram {
  /**
   * @param {string} type - Diagram type (e.g. `plantuml`, `mermaid`).
   * @param {string} format - Output format (e.g. `svg`, `png`).
   * @param {string} text - Diagram source text.
   * @param {Object<string, string|number>} opts - Diagram-specific rendering options forwarded as query parameters and headers.
   */
  constructor(type, format, text, opts) {
    this.text = text
    this.type = type
    this.format = format
    this.opts = opts
  }

  /**
   * Builds the GET URI for this diagram against the given Kroki server URL.
   * Options are appended as URL-encoded query parameters.
   *
   * @param {string} serverUrl - Base URL of the Kroki server (e.g. `https://kroki.io`).
   * @returns {string} Fully-qualified diagram URI.
   */
  getDiagramUri(serverUrl) {
    const queryParams = Object.entries(this.opts)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value.toString())}`,
      )
      .join('&')
    return `${serverUrl}/${this.type}/${this.format}/${this.encode()}${queryParams ? `?${queryParams}` : ''}`
  }

  /**
   * Encodes the diagram source text using zlib deflate (level 9) and base64url encoding,
   * as required by the Kroki GET endpoint.
   *
   * @returns {string} Base64url-encoded deflated representation of the diagram text.
   */
  encode() {
    const data = Buffer.from(this.text, 'utf8')
    const compressed = pako.deflate(data, { level: 9 })
    return Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }
}

/**
 * HTTP client that communicates with a Kroki server to fetch rendered diagrams.
 * Supports GET, POST, and adaptive (GET with POST fallback when the URI is too long) strategies.
 */
export class KrokiClient {
  /**
   * @param {Object} doc - Asciidoctor document whose attributes configure the client
   *   (`kroki-server-url`, `kroki-http-method`, `kroki-max-uri-length`).
   * @param {Object} httpClient - HTTP adapter exposing `get(uri, headers, encoding)` and
   *   `post(uri, body, headers, encoding)` methods.
   */
  constructor(doc, httpClient) {
    const maxUriLengthValue = parseInt(
      doc.getAttribute(
        'kroki-max-uri-length',
        MAX_URI_DEFAULT_VALUE.toString(),
      ),
      10,
    )
    this.maxUriLength = Number.isNaN(maxUriLengthValue)
      ? MAX_URI_DEFAULT_VALUE
      : maxUriLengthValue
    this.httpClient = httpClient
    const method = doc
      .getAttribute('kroki-http-method', 'adaptive')
      .toLowerCase()
    if (method === 'get' || method === 'post' || method === 'adaptive') {
      this.method = method
    } else {
      console.warn(
        `Invalid value '${method}' for kroki-http-method attribute. The value must be either: 'get', 'post' or 'adaptive'. Proceeding using: 'adaptive'.`,
      )
      this.method = 'adaptive'
    }
    this.doc = doc
  }

  /**
   * Fetches the diagram from Kroki and returns its content as a UTF-8 string.
   * Typically used for text-based formats such as SVG.
   *
   * @param {KrokiDiagram} krokiDiagram - Diagram to render.
   * @returns {Promise<string>} Rendered diagram content.
   */
  async getTextContent(krokiDiagram) {
    return this.getImage(krokiDiagram, 'utf8')
  }

  /**
   * Fetches the rendered diagram from Kroki using the configured HTTP method strategy.
   *
   * In `adaptive` mode the request is sent as GET; if the resulting URI exceeds
   * {@link KrokiClient#maxUriLength} the diagram source is sent via POST instead.
   * In `get` mode GET is always used (the server may respond with 414 for very long URIs).
   * In `post` mode POST is always used.
   *
   * @param {KrokiDiagram} krokiDiagram - Diagram to render.
   * @param {BufferEncoding|null} encoding - Encoding for the response body, or `null` for binary.
   * @returns {Promise<string>} Rendered diagram content.
   */
  async getImage(krokiDiagram, encoding) {
    const serverUrl = this.getServerUrl()
    const type = krokiDiagram.type
    const format = krokiDiagram.format
    const text = krokiDiagram.text
    const opts = krokiDiagram.opts
    const headers = {
      Referer: REFERER,
      ...Object.fromEntries(
        Object.entries(opts).map(([key, value]) => [
          `Kroki-Diagram-Options-${key}`,
          value,
        ]),
      ),
    }
    const expectedContentType = MIME_TYPES[format]
    if (this.method === 'adaptive' || this.method === 'get') {
      const uri = krokiDiagram.getDiagramUri(serverUrl)
      if (uri.length > this.maxUriLength) {
        // The request URI is longer than the max URI length.
        if (this.method === 'get') {
          // The request might be rejected by the server with a 414 Request-URI Too Large.
          // Consider using the attribute kroki-http-method with the value 'adaptive'.
          return this.httpClient.get(uri, headers, encoding, expectedContentType)
        }
        return this.httpClient.post(
          `${serverUrl}/${type}/${format}`,
          text,
          headers,
          encoding,
          expectedContentType,
        )
      }
      return this.httpClient.get(uri, headers, encoding, expectedContentType)
    }
    return this.httpClient.post(
      `${serverUrl}/${type}/${format}`,
      text,
      headers,
      encoding,
      expectedContentType,
    )
  }

  /**
   * Returns the Kroki server URL, falling back to `https://kroki.io` when the
   * `kroki-server-url` document attribute is not set.
   *
   * @returns {string} Kroki server base URL.
   */
  getServerUrl() {
    return this.doc.getAttribute('kroki-server-url') || 'https://kroki.io'
  }
}
