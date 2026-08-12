/**
 * Repositório in-memory de regras fiscais (Fases 5+6).
 * Inicia vazio — regras devem ser injetadas explicitamente.
 */
import { createDefaultTestRules } from './fixtures/default-test-rules.js';
import { validateRuleDependencies } from './fiscal-rule-validation.js';

/** @type {Map<string, import('../types/fiscal-rule.js').FiscalRule>} */
const globalRules = new Map();

/** @type {Map<string, Map<string, import('../types/fiscal-rule.js').FiscalRule>>} */
const tenantRules = new Map();

const storeRule = (rule) => {
  if (rule.empresaId) {
    const bucket = tenantRules.get(rule.empresaId) ?? new Map();
    bucket.set(rule.id, rule);
    tenantRules.set(rule.empresaId, bucket);
    return;
  }
  globalRules.set(rule.id, rule);
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {object} [options]
 * @param {boolean} [options.skipDependencyValidation]
 */
export const registerFiscalRules = (rules, options = {}) => {
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!options.skipDependencyValidation) {
      const validation = validateRuleDependencies(rule);
      if (!validation.ok) {
        throw new Error(validation.errors.join(' '));
      }
    }
    storeRule(rule);
  }
};

/**
 * @param {string | null | undefined} empresaId
 */
export const listFiscalRulesForEmpresa = (empresaId = null) => {
  const globals = [...globalRules.values()];
  if (!empresaId) return globals;
  const tenant = tenantRules.get(empresaId);
  return [...globals, ...(tenant ? [...tenant.values()] : [])];
};

export const resetFiscalRulesRepository = () => {
  globalRules.clear();
  tenantRules.clear();
};

/** Helper explícito para testes — nunca invocado pelo pipeline de produção. */
export const bootstrapDefaultTestRules = () => {
  resetFiscalRulesRepository();
  registerFiscalRules(createDefaultTestRules());
};

/** @internal */
export const __getFiscalRulesStoreForTests = () => ({
  globalRules,
  tenantRules,
});
