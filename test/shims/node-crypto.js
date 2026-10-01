export function createHash() {
  return {
    update() {
      return this
    },
    digest() {
      return ''
    },
  }
}

export function randomBytes() {
  throw new Error(
    'node:crypto randomBytes() is not supported in browser environments',
  )
}

export default { createHash, randomBytes }
