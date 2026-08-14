/**
 * Política de execução de regras fiscais (modo SAFE vs experimental).
 */
import { isAccountantApprovedConfigurationRule } from '../fiscal-configuration/approved-rule-to-fiscal-rules.js';

/**
 * @param {object} [options]
 * @returns {{ allowNonProductionRules: boolean, allowAccountantApprovedConfiguration: boolean }}
 */
export const normalizeResolverOptions = (options = {}) => ({
  allowNonProductionRules: options.allowNonProductionRules === true,
  allowAccountantApprovedConfiguration: options.allowAccountantApprovedConfiguration === true,
  matchingFacts: options.matchingFacts ?? {},
});

export const DEFAULT_RESOLVER_OPTIONS = Object.freeze({
  allowNonProductionRules: false,
  allowAccountantApprovedConfiguration: false,
});

/**
 * TEST-ONLY — bypass genérico de productionReady.
 * Não usar em runtime produtivo de configuração fiscal.
 * @param {object} [options]
 */
export const normalizeTestOnlyResolverOptions = (options = {}) => ({
  ...normalizeResolverOptions(options),
  allowNonProductionRules: true,
});

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 * @param {{ allowNonProductionRules: boolean, allowAccountantApprovedConfiguration: boolean }} resolverOptions
 */
export const isRuleEligibleForExecution = (rule, resolverOptions) => {
  if (rule.productionReady === true) return true;
  if (resolverOptions.allowAccountantApprovedConfiguration && isAccountantApprovedConfigurationRule(rule)) {
    return true;
  }
  if (resolverOptions.allowNonProductionRules) return true;
  return false;
};
