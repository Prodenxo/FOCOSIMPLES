/**
 * Deep clone seguro para snapshot shadow síncrono.
 * @param {object} value
 */
let forceCloneErrorForTests = false;

/** @internal */
export const __forceShadowCloneErrorForTests = (enabled) => {
  forceCloneErrorForTests = Boolean(enabled);
};

export const clonePayloadForShadow = (value) => {
  if (forceCloneErrorForTests) {
    throw new Error('forced sync clone error for tests');
  }
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};
