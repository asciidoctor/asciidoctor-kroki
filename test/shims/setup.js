// Minimal process polyfill for browser tests.
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    cwd: () => '/',
    env: {},
    platform: 'browser',
  }
}

// Minimal Buffer polyfill for browser tests.
if (typeof globalThis.Buffer === 'undefined') {
  function bufferToString(bytes, encoding = 'utf8') {
    if (encoding === 'base64') {
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    }
    return new TextDecoder(encoding).decode(bytes)
  }

  function wrap(bytes) {
    return Object.assign(bytes, {
      toString: (enc) => bufferToString(bytes, enc),
    })
  }

  // biome-ignore lint: lint/complexity/noStaticOnlyClass
  globalThis.Buffer = class Buffer {
    static byteLength(str, _encoding = 'utf8') {
      return new TextEncoder().encode(str).length
    }

    static from(data, encoding) {
      if (typeof data === 'string') {
        if (encoding === 'base64') {
          const binary = atob(data)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i)
          return wrap(bytes)
        }
        return wrap(new TextEncoder().encode(data))
      }
      return wrap(new Uint8Array(data))
    }

    static isBuffer(obj) {
      return obj instanceof Uint8Array
    }

    static concat(bufs) {
      const total = bufs.reduce((n, b) => n + b.length, 0)
      const result = new Uint8Array(total)
      let offset = 0
      for (const b of bufs) {
        result.set(b, offset)
        offset += b.length
      }
      return wrap(result)
    }

    static alloc(size, fill = 0) {
      const buf = new Uint8Array(size)
      if (fill) buf.fill(fill)
      return wrap(buf)
    }
  }
}
