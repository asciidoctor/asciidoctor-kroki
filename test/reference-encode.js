import pako from 'pako'

/**
 * Buffer-free reference implementation of the Kroki diagram encoding
 * (raw zlib deflate at level 9, then base64url). It mirrors the wire format the
 * Kroki GET endpoint expects but never touches the Node-only `Buffer`, so it can
 * validate {@link KrokiDiagram#encode} dynamically for any text in both Node.js
 * and a real browser (VS Code for the Web / vscode.dev).
 *
 * @param {string} text - Diagram source text.
 * @returns {string} Base64url-encoded deflated representation of the text.
 */
export function referenceEncode(text) {
  const compressed = pako.deflate(new TextEncoder().encode(text), { level: 9 })
  let binary = ''
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}
