/**
 * Returns the value of an attribute as a trimmed string, or `undefined` if it has none
 * (unset, empty, blank, or `true` for a flag set through the API), so that the caller's default applies.
 *
 * @param {*} value - Attribute value.
 * @returns {string|undefined} Trimmed value, or `undefined` if it has none.
 */
export function attrValue(value) {
  if (value === undefined || value === null || value === true) {
    return undefined
  }
  return String(value).trim() || undefined
}
