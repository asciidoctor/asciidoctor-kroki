import { expect } from 'vitest'

function equal(actual, expected, message) {
  expect(actual, message).toBe(expected)
}
function deepEqual(actual, expected, message) {
  expect(actual, message).toEqual(expected)
}
function strictEqual(actual, expected, message) {
  expect(actual, message).toBe(expected)
}
function deepStrictEqual(actual, expected, message) {
  expect(actual, message).toStrictEqual(expected)
}
function notEqual(actual, expected, message) {
  expect(actual, message).not.toBe(expected)
}
function notDeepStrictEqual(actual, expected, message) {
  expect(actual, message).not.toStrictEqual(expected)
}
function ok(value, message) {
  expect(value, message).toBeTruthy()
}
function fail(message) {
  throw new Error(message || 'Assertion failed')
}
function match(actual, pattern, message) {
  expect(actual, message).toMatch(pattern)
}
function doesNotMatch(actual, pattern, message) {
  expect(actual, message).not.toMatch(pattern)
}
function throws(fn, _errorOrMessage, _message) {
  expect(fn).toThrow()
}
async function rejects(fnOrPromise, _errorOrMessage, _message) {
  const p = typeof fnOrPromise === 'function' ? fnOrPromise() : fnOrPromise
  await expect(p).rejects.toThrow()
}

function assert(value, message) {
  ok(value, message)
}
assert.equal = equal
assert.deepEqual = deepEqual
assert.strictEqual = strictEqual
assert.deepStrictEqual = deepStrictEqual
assert.notEqual = notEqual
assert.notDeepStrictEqual = notDeepStrictEqual
assert.ok = ok
assert.fail = fail
assert.match = match
assert.doesNotMatch = doesNotMatch
assert.throws = throws
assert.rejects = rejects

export {
  deepEqual,
  deepStrictEqual,
  doesNotMatch,
  equal,
  fail,
  match,
  notDeepStrictEqual,
  notEqual,
  ok,
  rejects,
  strictEqual,
  throws,
}
export default assert
