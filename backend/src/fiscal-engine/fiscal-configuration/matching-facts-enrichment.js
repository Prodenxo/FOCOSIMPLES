/**
 * Enriquecimento async de fatos de matching — fiscalProductGroupId.
 * NÃO altera FiscalContext core.
 */
import { extractMatchingFactsFromContext } from './matching-facts.js';
import { getActiveFiscalProductGroupIdForProduct } from './fiscal-configuration-repository.service.js';

/**
 * @param {object} context
 * @param {object} [options]
 */
export const enrichMatchingFactsForContext = async (context, options = {}) => {
  const base = extractMatchingFactsFromContext(context, options.treatmentPartial ?? {});
  const tenantId = context.empresaId;
  const productId = base.productId;

  if (!tenantId || !productId) {
    return { ...base, fiscalProductGroupId: null };
  }

  const fiscalProductGroupId = await getActiveFiscalProductGroupIdForProduct({
    tenantId,
    productId,
  });

  return {
    ...base,
    fiscalProductGroupId: fiscalProductGroupId ?? null,
  };
};

export { extractMatchingFactsFromContext };
