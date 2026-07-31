/**
 * Encodes a byte array to a standard (RFC 4648) base64 string.
 * Uses `btoa`, which is a global in both Node.js (>=16) and browsers, so the
 * result is identical to the Node-only base64 encoding of the same bytes
 * without relying on a global that browser bundlers do not provide.
 *
 * @param {Uint8Array} bytes - Bytes to encode.
 * @returns {string} Base64-encoded representation.
 */
export function toBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
