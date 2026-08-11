/**
 * @typedef {object} FiscalRuleRef
 * @property {string} id
 * @property {string} [ruleType]
 * @property {string} [rulePackageId]
 * @property {string} [sourceLegalReference]
 * @property {boolean} [productionReady]
 */

/**
 * @param {Partial<FiscalRuleRef>} ref
 * @returns {FiscalRuleRef}
 */
export const fiscalRuleRef = (ref) => ({
  id: String(ref.id || ''),
  ruleType: ref.ruleType,
  rulePackageId: ref.rulePackageId,
  sourceLegalReference: ref.sourceLegalReference,
  productionReady: ref.productionReady,
});
