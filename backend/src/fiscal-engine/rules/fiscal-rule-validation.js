/**
 * Valida dependências de regras — evita circularidade em CURRENT_ST.
 */

/** @type {readonly string[]} */
export const CURRENT_ST_FORBIDDEN_CONDITION_KEYS = Object.freeze([
  'currentOperationSt',
  'stScenarioKey',
  'csosn',
  'cfop',
  'cst',
]);

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export const validateRuleDependencies = (rule) => {
  const errors = [];
  if (!rule || typeof rule !== 'object') {
    return { ok: false, errors: ['rule deve ser objeto'] };
  }

  if (rule.ruleType === 'CURRENT_ST') {
    const conditions = rule.conditions && typeof rule.conditions === 'object'
      ? rule.conditions
      : {};
    for (const key of CURRENT_ST_FORBIDDEN_CONDITION_KEYS) {
      if (conditions[key] != null) {
        errors.push(
          `Regra CURRENT_ST ${rule.id} não pode depender de "${key}" — circularidade proibida.`,
        );
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
};
