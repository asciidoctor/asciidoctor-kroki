export function createHash() {
  return {
    update() { return this },
    digest() { return '' },
  }
}

export default { createHash }