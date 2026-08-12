/**
 * Política de execução de regras fiscais (modo SAFE vs experimental).
 */

/**
 * @param {object} [options]
 * @returns {{ allowNonProductionRules: boolean }}
 */
export const normalizeResolverOptions = (options = {}) => ({
  allowNonProductionRules: options.allowNonProductionRules === true,
});

export const DEFAULT_RESOLVER_OPTIONS = Object.freeze({
  allowNonProductionRules: false,
});
