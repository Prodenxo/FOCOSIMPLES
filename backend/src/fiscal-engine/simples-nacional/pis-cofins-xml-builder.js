/**
 * Builder XML PIS/COFINS — serializa resultado calculado, NÃO recalcula.
 */
import { PIS_COFINS_CALCULATION_MODES } from './pis-cofins-xml-group-contract.js';

/**
 * @param {object} calculation — resultado de calculatePisCofinsFromConfig
 */
export const buildPisCofinsXmlEntry = (calculation) => {
  if (!calculation?.ok) return null;
  const result = calculation.result;
  /** @type {Record<string, string>} */
  const fields = { CST: result.cst };

  if (result.calculationMode === PIS_COFINS_CALCULATION_MODES.NT) {
    return { group: result.group, fields };
  }

  if (result.calculationMode === PIS_COFINS_CALCULATION_MODES.OUTR_ZERO) {
    fields.vBC = result.vBC;
    if (result.group.startsWith('PIS')) {
      fields.pPIS = result.pPIS;
      fields.vPIS = result.vPIS;
    } else {
      fields.pCOFINS = result.pCOFINS;
      fields.vCOFINS = result.vCOFINS;
    }
    return { group: result.group, fields };
  }

  if (result.calculationMode === PIS_COFINS_CALCULATION_MODES.ALIQ_PERCENT) {
    fields.vBC = result.vBC;
    if (result.group.startsWith('PIS')) {
      fields.pPIS = result.pPIS;
      fields.vPIS = result.vPIS;
    } else {
      fields.pCOFINS = result.pCOFINS;
      fields.vCOFINS = result.vCOFINS;
    }
    return { group: result.group, fields };
  }

  return null;
};

/**
 * @param {object} pisCofinsResolution
 */
export const buildPisCofinsAuditMetadata = (pisCofinsResolution) => {
  if (!pisCofinsResolution?.ok) return null;
  const audit = { ...(pisCofinsResolution.audit ?? {}) };

  if (pisCofinsResolution.pis?.ok) {
    audit.pis = {
      cst: pisCofinsResolution.pis.result.cst,
      calculationMode: pisCofinsResolution.pis.result.calculationMode,
      baseSource: pisCofinsResolution.pis.result.baseSource,
      base: pisCofinsResolution.pis.result.base,
      rate: pisCofinsResolution.pis.result.rate,
      value: pisCofinsResolution.pis.result.value,
      group: pisCofinsResolution.pis.result.group,
    };
  }

  if (pisCofinsResolution.cofins?.ok) {
    audit.cofins = {
      cst: pisCofinsResolution.cofins.result.cst,
      calculationMode: pisCofinsResolution.cofins.result.calculationMode,
      baseSource: pisCofinsResolution.cofins.result.baseSource,
      base: pisCofinsResolution.cofins.result.base,
      rate: pisCofinsResolution.cofins.result.rate,
      value: pisCofinsResolution.cofins.result.value,
      group: pisCofinsResolution.cofins.result.group,
    };
  }

  return audit;
};
