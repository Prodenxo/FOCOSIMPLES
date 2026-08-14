/**
 * Bridge técnica Fiscal Engine V3 (canonical/XML) → shape PlugNotas (tributos).
 * Transformação de representação apenas — sem decisão fiscal.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { PIS_COFINS_CALCULATION_MODES } from '../simples-nacional/pis-cofins-xml-group-contract.js';

export const PLUGNOTAS_NFE_TAX_BRIDGE_CAPABILITY = 'PLUGNOTAS_NFE_TAX_BRIDGE';

/** Campos ICMS XML → PlugNotas (mapeamento mecânico 1:1). */
const ICMS_XML_TO_PLUGNOTAS_FIELD_MAP = Object.freeze({
  modBCST: 'modBCST',
  pMVAST: 'pMVAST',
  pRedBCST: 'pRedBCST',
  vBCST: 'vBCST',
  pICMSST: 'pICMSST',
  vICMSST: 'vICMSST',
  vBCSTRet: 'vBCSTRet',
  vICMSSTRet: 'vICMSSTRet',
  pST: 'pST',
  vICMSSubstituto: 'vICMSSubstituto',
  vBCFCPSTRet: 'vBCFCPSTRet',
  pFCPSTRet: 'pFCPSTRet',
  vFCPSTRet: 'vFCPSTRet',
  vBCEfet: 'vBCEfet',
  pICMSEfet: 'pICMSEfet',
  vICMSEfet: 'vICMSEfet',
});

/**
 * @param {string} message
 * @param {object} [meta]
 */
const bridgeError = (message, meta = {}) => {
  const err = new Error(message);
  err.code = 'PLUGNOTAS_TAX_BRIDGE_INCOMPLETE';
  err.meta = meta;
  return err;
};

const parseBridgeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    throw bridgeError('Valor numérico ausente na bridge PlugNotas');
  }
  const parsed = Number(String(value).replace(',', '.'));
  if (Number.isNaN(parsed)) {
    throw bridgeError(`Valor numérico inválido na bridge: ${value}`);
  }
  return parsed;
};

/**
 * @param {object | null | undefined} icmsEntry — { group, fields } ou fields planos
 */
export const mapFiscalV3IcmsToPlugnotasTributos = (icmsEntry) => {
  const fields = icmsEntry?.fields ?? icmsEntry ?? {};
  const origem = fields.orig ?? fields.origem;
  if (origem == null || origem === '') {
    throw bridgeError('ICMS orig/origem ausente no canonical V3');
  }

  const csosn = fields.CSOSN ?? fields.csosn ?? null;
  const cst = fields.CST ?? fields.cst ?? null;
  if (!csosn && !cst) {
    throw bridgeError('ICMS CSOSN/CST ausente no canonical V3');
  }

  /** @type {Record<string, unknown>} */
  const out = { origem: String(origem) };
  if (csosn) out.csosn = String(csosn);
  if (cst && !csosn) out.cst = String(cst);

  for (const [xmlKey, plugKey] of Object.entries(ICMS_XML_TO_PLUGNOTAS_FIELD_MAP)) {
    if (fields[xmlKey] != null && fields[xmlKey] !== '') {
      out[plugKey] = fields[xmlKey];
    }
  }

  return out;
};

/**
 * @param {object | null | undefined} entry — { group, fields }
 * @param {'pis' | 'cofins'} tax
 */
export const mapFiscalV3PisCofinsToPlugnotasTributos = (entry, tax) => {
  if (!entry?.fields) {
    throw bridgeError(`${tax} canonical ausente na bridge PlugNotas`);
  }

  const fields = entry.fields;
  const cstRaw = fields.CST ?? fields.cst;
  if (cstRaw == null || cstRaw === '') {
    throw bridgeError(`${tax} CST ausente no canonical V3`);
  }
  const cst = String(cstRaw).padStart(2, '0').slice(0, 2);
  const group = String(entry.group ?? '');

  if (group.endsWith('NT')) {
    // Shape mínimo — zeros PlugNotas são providerSerialization em normalizeNfePisCofinsForPlugnotasSn.
    return { cst };
  }

  if (group.includes('Outr')) {
    if (fields.vBC == null || fields.vBC === '') {
      throw bridgeError(`${tax} vBC ausente para OUTR_ZERO — bridge não inventa base`);
    }
    const rateKey = tax === 'pis' ? 'pPIS' : 'pCOFINS';
    const valueKey = tax === 'pis' ? 'vPIS' : 'vCOFINS';
    if (fields[rateKey] == null || fields[rateKey] === '') {
      throw bridgeError(`${tax} ${rateKey} ausente para OUTR_ZERO — bridge não inventa alíquota`);
    }
    if (fields[valueKey] == null || fields[valueKey] === '') {
      throw bridgeError(`${tax} ${valueKey} ausente para OUTR_ZERO — bridge não inventa valor`);
    }

    return {
      cst,
      baseCalculo: { valor: parseBridgeNumber(fields.vBC) },
      aliquota: parseBridgeNumber(fields[rateKey]),
      valor: parseBridgeNumber(fields[valueKey]),
    };
  }

  throw bridgeError(`Grupo ${tax} não suportado pela bridge PlugNotas: ${group}`, { group, tax });
};

/**
 * @param {import('../types/fiscal-result.js').FiscalResult} fiscalResult
 */
export const mapFiscalV3TaxesToPlugnotasTributos = (fiscalResult) => {
  const taxes = fiscalResult?.resolutions?.xmlFields?.taxes;
  if (!taxes?.icms) {
    throw bridgeError('Grupo ICMS ausente no FiscalResult canonical');
  }

  /** @type {Record<string, object>} */
  const tributos = {
    icms: mapFiscalV3IcmsToPlugnotasTributos(taxes.icms),
  };

  if (taxes.pis) {
    tributos.pis = mapFiscalV3PisCofinsToPlugnotasTributos(taxes.pis, 'pis');
  }
  if (taxes.cofins) {
    tributos.cofins = mapFiscalV3PisCofinsToPlugnotasTributos(taxes.cofins, 'cofins');
  }

  return tributos;
};

/**
 * @param {import('../types/fiscal-result.js').FiscalResult} fiscalResult
 */
export const evaluatePlugnotasNfeTaxBridgeCapability = (fiscalResult) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];

  try {
    mapFiscalV3TaxesToPlugnotasTributos(fiscalResult);
    return { ok: true, capability: PLUGNOTAS_NFE_TAX_BRIDGE_CAPABILITY, issues };
  } catch (error) {
    issues.push(createFiscalIssue(
      'AUTHORITATIVE_PROVIDER_BRIDGE_NOT_EXECUTABLE',
      error instanceof Error ? error.message : String(error),
      {
        severity: 'ERROR',
        blocksEmission: true,
        overrideAllowed: false,
        meta: {
          capability: PLUGNOTAS_NFE_TAX_BRIDGE_CAPABILITY,
          ...(error?.meta ?? {}),
        },
      },
    ));
    return { ok: false, capability: PLUGNOTAS_NFE_TAX_BRIDGE_CAPABILITY, issues };
  }
};

/**
 * Deriva item.tributos exclusivamente do FiscalResult V3 — substitui stale legacy.
 * @param {object} item
 * @param {import('../types/fiscal-result.js').FiscalResult} fiscalResult
 */
export const applyPlugnotasTributosBridgeToAuthoritativeItem = (item, fiscalResult) => {
  const tributos = mapFiscalV3TaxesToPlugnotasTributos(fiscalResult);
  return {
    ...item,
    tributos,
  };
};

/**
 * Aplica bridge em todos os itens do payload authoritative.
 * @param {object} params
 */
export const applyAuthoritativePlugnotasTributosBridge = ({ payload, itemGroups }) => {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      payload,
      issues: [createFiscalIssue('SCHEMA_INVALID', 'Payload authoritative inválido para bridge PlugNotas', { blocksEmission: true })],
    };
  }

  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  /** @type {object[]} */
  const bridgedItens = [];

  let itemOffset = 0;
  for (const group of itemGroups ?? []) {
    const fiscalResults = group.fiscalResults ?? [];
    for (let i = 0; i < fiscalResults.length; i += 1) {
      const fiscalResult = fiscalResults[i];
      const bridgeCap = evaluatePlugnotasNfeTaxBridgeCapability(fiscalResult);
      if (!bridgeCap.ok) {
        issues.push(...bridgeCap.issues);
        continue;
      }

      const sourceItem = itens[itemOffset] ?? {};
      try {
        bridgedItens.push(applyPlugnotasTributosBridgeToAuthoritativeItem(sourceItem, fiscalResult));
      } catch (error) {
        issues.push(createFiscalIssue(
          'AUTHORITATIVE_PROVIDER_BRIDGE_NOT_EXECUTABLE',
          error instanceof Error ? error.message : String(error),
          { blocksEmission: true, overrideAllowed: false },
        ));
      }
      itemOffset += 1;
    }
  }

  if (issues.some((issue) => issue.blocksEmission)) {
    return { ok: false, payload, issues };
  }

  if (bridgedItens.length !== itens.length) {
    issues.push(createFiscalIssue(
      'SCHEMA_INVALID',
      'Bridge PlugNotas — contagem de itens divergente do payload authoritative',
      { blocksEmission: true },
    ));
    return { ok: false, payload, issues };
  }

  return {
    ok: true,
    payload: { ...payload, itens: bridgedItens },
    issues,
  };
};

export { PIS_COFINS_CALCULATION_MODES };
