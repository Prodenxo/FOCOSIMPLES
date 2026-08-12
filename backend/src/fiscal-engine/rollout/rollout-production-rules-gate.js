/**
 * Verificação de regras productionReady — gate authoritative.
 */
import { listFiscalRulesForEmpresa } from '../rules/fiscal-rule-memory.repository.js';

/**
 * @param {string} empresaId
 */
export const hasProductionReadyFiscalRules = (empresaId) => {
  const rules = listFiscalRulesForEmpresa(empresaId);
  return rules.some((rule) => rule.productionReady === true);
};

/**
 * @param {string} empresaId
 */
export const countProductionReadyFiscalRules = (empresaId) => {
  const rules = listFiscalRulesForEmpresa(empresaId);
  return rules.filter((rule) => rule.productionReady === true).length;
};
