/**
 * Matriz interna Phase 8E.4 — grupos XML PIS/COFINS.
 * Derivado de plugnotas-nfe-payload.js (SIMPLES_PIS_COFINS_CSTS) + shape NF-e.
 */
export const PIS_COFINS_CALCULATION_MODES = Object.freeze({
  NT: 'NT',
  OUTR_ZERO: 'OUTR_ZERO',
  ALIQ_PERCENT: 'ALIQ_PERCENT',
  QTDE: 'QTDE',
});

/** CST → grupo/modo — conhecidos no repo (Plugnotas SN). */
export const PIS_XML_GROUP_CONTRACT = Object.freeze({
  PISNT: Object.freeze({
    tax: 'pis',
    group: 'PISNT',
    csts: Object.freeze(['07', '08']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.NT,
    executable: true,
    requiredFields: Object.freeze(['CST']),
    calculatedFields: Object.freeze([]),
    optionalFields: Object.freeze([]),
  }),
  PISOutr: Object.freeze({
    tax: 'pis',
    group: 'PISOutr',
    csts: Object.freeze(['49', '99']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
    executable: true,
    requiredFields: Object.freeze(['CST', 'vBC', 'pPIS', 'vPIS']),
    calculatedFields: Object.freeze(['vBC', 'vPIS']),
    optionalFields: Object.freeze([]),
  }),
  PISAliq: Object.freeze({
    tax: 'pis',
    group: 'PISAliq',
    csts: Object.freeze(['01', '02']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.ALIQ_PERCENT,
    executable: false,
    requiredFields: Object.freeze(['CST', 'vBC', 'pPIS', 'vPIS']),
    calculatedFields: Object.freeze(['vBC', 'vPIS']),
    optionalFields: Object.freeze([]),
  }),
  PISQtde: Object.freeze({
    tax: 'pis',
    group: 'PISQtde',
    csts: Object.freeze(['03']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.QTDE,
    executable: false,
    requiredFields: Object.freeze(['CST', 'qBCProd', 'vAliqProd', 'vPIS']),
    calculatedFields: Object.freeze(['vPIS']),
    optionalFields: Object.freeze([]),
  }),
});

export const COFINS_XML_GROUP_CONTRACT = Object.freeze({
  COFINSNT: Object.freeze({
    tax: 'cofins',
    group: 'COFINSNT',
    csts: Object.freeze(['07', '08']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.NT,
    executable: true,
    requiredFields: Object.freeze(['CST']),
    calculatedFields: Object.freeze([]),
    optionalFields: Object.freeze([]),
  }),
  COFINSOutr: Object.freeze({
    tax: 'cofins',
    group: 'COFINSOutr',
    csts: Object.freeze(['49', '99']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
    executable: true,
    requiredFields: Object.freeze(['CST', 'vBC', 'pCOFINS', 'vCOFINS']),
    calculatedFields: Object.freeze(['vBC', 'vCOFINS']),
    optionalFields: Object.freeze([]),
  }),
  COFINSAliq: Object.freeze({
    tax: 'cofins',
    group: 'COFINSAliq',
    csts: Object.freeze(['01', '02']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.ALIQ_PERCENT,
    executable: false,
    requiredFields: Object.freeze(['CST', 'vBC', 'pCOFINS', 'vCOFINS']),
    calculatedFields: Object.freeze(['vBC', 'vCOFINS']),
    optionalFields: Object.freeze([]),
  }),
  COFINSQtde: Object.freeze({
    tax: 'cofins',
    group: 'COFINSQtde',
    csts: Object.freeze(['03']),
    calculationMode: PIS_COFINS_CALCULATION_MODES.QTDE,
    executable: false,
    requiredFields: Object.freeze(['CST', 'qBCProd', 'vAliqProd', 'vCOFINS']),
    calculatedFields: Object.freeze(['vCOFINS']),
    optionalFields: Object.freeze([]),
  }),
});

const buildCstIndex = (contracts) => {
  /** @type {Map<string, object>} */
  const index = new Map();
  for (const contract of Object.values(contracts)) {
    for (const cst of contract.csts) {
      index.set(cst, contract);
    }
  }
  return index;
};

const PIS_CST_INDEX = buildCstIndex(PIS_XML_GROUP_CONTRACT);
const COFINS_CST_INDEX = buildCstIndex(COFINS_XML_GROUP_CONTRACT);

export const PIS_COFINS_KNOWN_CSTS = Object.freeze(new Set([
  ...PIS_CST_INDEX.keys(),
  ...COFINS_CST_INDEX.keys(),
]));

export const PIS_COFINS_EXECUTABLE_CSTS = Object.freeze(new Set(
  [...PIS_CST_INDEX.entries(), ...COFINS_CST_INDEX.entries()]
    .filter(([, contract]) => contract.executable)
    .map(([cst]) => cst),
));

/**
 * @param {string} cst
 * @param {'pis' | 'cofins'} tax
 */
export const getPisCofinsGroupForCst = (cst, tax = 'pis') => {
  const normalized = String(cst ?? '').padStart(2, '0').slice(0, 2);
  const index = tax === 'pis' ? PIS_CST_INDEX : COFINS_CST_INDEX;
  return index.get(normalized) ?? null;
};

/**
 * @param {string} cst
 * @param {Record<string, string>} fields
 * @param {'pis' | 'cofins'} tax
 */
export const assertPisCofinsXmlFieldsComplete = (cst, fields = {}, tax = 'pis') => {
  const contract = getPisCofinsGroupForCst(cst, tax);
  if (!contract?.executable) {
    return { ok: false, reason: 'GROUP_NOT_EXECUTABLE', missing: [], contract };
  }
  /** @type {string[]} */
  const missing = [];
  for (const field of contract.requiredFields) {
    if (fields[field] == null || fields[field] === '') missing.push(field);
  }
  return { ok: missing.length === 0, contract, missing, group: contract.group };
};
