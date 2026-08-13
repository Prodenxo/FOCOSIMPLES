/**
 * Gate de promoção productionReady=true — exige fonte legal oficial validada.
 */
import { validateFiscalRuleShape } from '../schemas/validate-shapes.js';
import { getFiscalLegalSource, isLegalSourceEffectiveOn } from './legal-source-registry.js';
import { validateCsosnCatalogCompatibility } from './csosn-catalog-crt1.js';

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 * @param {object} [options]
 * @param {string} [options.referenceDate]
 */
export const validateProductionReadyPromotion = (rule, { referenceDate } = {}) => {
  const errors = [];

  const shape = validateFiscalRuleShape(rule);
  if (!shape.ok) errors.push(...shape.errors);

  if (!rule.productionReady) {
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  if (!Array.isArray(rule.sourceRefs) || rule.sourceRefs.length === 0) {
    errors.push(`Regra ${rule.id}: productionReady exige sourceRefs não vazios.`);
  }

  const refDate = referenceDate ?? rule.effectiveFrom;
  for (const sourceId of rule.sourceRefs ?? []) {
    const source = getFiscalLegalSource(sourceId);
    if (!source) {
      errors.push(`Regra ${rule.id}: sourceRef "${sourceId}" não registrada.`);
      continue;
    }
    if (source.reviewStatus !== 'APPROVED' && source.reviewStatus !== 'REVIEWED') {
      errors.push(`Regra ${rule.id}: fonte ${sourceId} reviewStatus=${source.reviewStatus} insuficiente.`);
    }
    if (!isLegalSourceEffectiveOn(source, refDate)) {
      errors.push(`Regra ${rule.id}: fonte ${sourceId} ineficaz em ${refDate}.`);
    }
    if (!source.jurisdiction) {
      errors.push(`Regra ${rule.id}: fonte ${sourceId} sem jurisdiction.`);
    }
    if (!source.effectiveFrom) {
      errors.push(`Regra ${rule.id}: fonte ${sourceId} sem effectiveFrom.`);
    }
    if (!source.ruleVersion && !source.documentNumber) {
      errors.push(`Regra ${rule.id}: fonte ${sourceId} sem ruleVersion/documentNumber.`);
    }
  }

  if (rule.ruleType === 'CSOSN' && rule.result?.csosn) {
    const compat = validateCsosnCatalogCompatibility({
      csosn: rule.result.csosn,
      crt: rule.applicableCrt?.[0] ?? 1,
      priorStStatus: rule.conditions?.priorStStatus?.[0],
      currentOperationSt: rule.conditions?.currentOperationSt?.[0],
      stScenarioKey: rule.conditions?.stScenarioKey?.[0],
      itemSource: rule.conditions?.itemSource?.[0],
    });
    if (!compat.compatible) {
      errors.push(`Regra ${rule.id}: CSOSN incompatível com catálogo — ${compat.reason}.`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 */
export const assertAllProductionReadyRulesValid = (rules, options = {}) => {
  const failures = [];
  for (const rule of rules ?? []) {
    if (!rule.productionReady) continue;
    const v = validateProductionReadyPromotion(rule, options);
    if (!v.ok) failures.push(...v.errors);
  }
  if (failures.length) {
    throw new Error(`Production-ready gate failed:\n${failures.join('\n')}`);
  }
};
