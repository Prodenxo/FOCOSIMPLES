/**
 * Ponte emit legado — aplica regra APPROVED do contador antes do st-rules-engine.
 * Só entra quando há tenantId + produto do catálogo identificado.
 */
import { buildFiscalContextV31 } from '../fiscal-engine/context/build-fiscal-context.js';
import { resolveAccountantApprovedFiscalRule } from '../fiscal-engine/fiscal-configuration/approved-rule-matcher.js';
import { loadAccountantApprovedRulesForTenant } from '../fiscal-engine/fiscal-configuration/fiscal-configuration-loader.js';
import { enrichMatchingFactsForContext } from '../fiscal-engine/fiscal-configuration/matching-facts-enrichment.js';
import {
  filterAccountantRulesForEstablishment,
  normalizeEstablishmentIdFromEmitenteCpfCnpj,
} from '../fiscal-engine/establishment/fiscal-establishment-id.js';
import { dedupeApprovedAccountantRulesForEmit } from '../fiscal-engine/fiscal-configuration/dedupe-approved-rules-for-emit.js';
import { APPROVED_RULE_MATCH_STATUS } from '../fiscal-engine/fiscal-configuration/constants.js';
import { evaluateAccountantRuleEngineCapability } from '../fiscal-engine/fiscal-configuration/fiscal-engine-capability.js';
import { getApprovedResultFromRule } from '../fiscal-engine/fiscal-configuration/accountant-rule-conditions.js';
import {
  getCompanyFiscalProfile,
  getProductFiscalProfile,
  listCompanyFiscalProfiles,
} from '../fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import { ITEM_SOURCE } from '../fiscal-engine/types/item-source.js';
import { PRIOR_ST_STATUS } from '../fiscal-engine/types/st-allocation.js';
import { CSOSN_ST, CSOSN_TRIBUTADO_SN, normalizeUf } from './nfe-item-tax-engine.js';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const cfopScope = (cfop) => {
  const first = String(cfop || '').replace(/\D/g, '').slice(0, 1);
  if (first === '5') return 'estadual';
  if (first === '6') return 'interestadual';
  return 'unknown';
};

const resolveMergedCfop = (accountantCfop, matrixCfop) => {
  const accountant = String(accountantCfop || '').trim();
  const matrix = String(matrixCfop || '').trim();
  if (!accountant) return matrix || null;
  if (!matrix) return accountant || null;

  const accountantScope = cfopScope(accountant);
  const matrixScope = cfopScope(matrix);
  if (
    accountantScope !== 'unknown'
    && matrixScope !== 'unknown'
    && accountantScope !== matrixScope
  ) {
    return matrix;
  }

  return accountant;
};

/**
 * CSOSN 500 na regra do contador só vira ST na nota se o NCM tiver ST na matriz.
 * Evita exigir CEST em produtos sem ST (ex.: camisa 61091000).
 */
export const mergeAccountantTaxWithMatrixTax = (accountantTax, matrixTax) => {
  const accountantCsosn = String(accountantTax?.csosn ?? matrixTax?.csosn ?? CSOSN_TRIBUTADO_SN);
  const csosnIsSt = accountantCsosn === CSOSN_ST;
  const matrixHasSt = matrixTax?.has_st === true;
  const isSt = csosnIsSt && matrixHasSt;
  const csosn = isSt ? CSOSN_ST : (csosnIsSt ? CSOSN_TRIBUTADO_SN : accountantCsosn);

  return {
    cfop: resolveMergedCfop(accountantTax?.cfop, matrixTax?.cfop),
    csosn,
    has_st: isSt,
    cest: isSt ? (accountantTax?.cest ?? matrixTax?.cest ?? null) : null,
  };
};

/**
 * @param {{
 *   tenantId: string,
 *   emitente: object,
 *   destinatario: object,
 *   item: object,
 *   originUf: string,
 *   destinationUf: string,
 *   businessType?: string | null,
 *   catalogProductId: string,
 *   approvedRulesCache?: object[] | null,
 *   legacyCfopCsosnOnly?: boolean,
 * }} input
 * @returns {Promise<{ cfop: string, csosn: string, has_st: boolean, cest?: string | null } | null>}
 */
export const tryResolveAccountantTaxForNfeItem = async (input) => {
  const tenantId = String(input.tenantId ?? '').trim();
  const catalogProductId = String(input.catalogProductId ?? '').trim();
  if (!tenantId || !catalogProductId) return null;

  const emitente = toObject(input.emitente);
  const destinatario = toObject(input.destinatario);
  const item = toObject(input.item);
  const originUf = normalizeUf(input.originUf);
  const destinationUf = normalizeUf(input.destinationUf);
  if (!originUf || !destinationUf) return null;

  const emitenteCnpj = String(emitente.cpfCnpj ?? emitente.cnpj ?? '').replace(/\D/g, '');
  let establishmentId = emitente.establishmentId
    ?? normalizeEstablishmentIdFromEmitenteCpfCnpj(emitenteCnpj);

  if (!establishmentId && tenantId) {
    const profiles = await listCompanyFiscalProfiles(tenantId);
    const profileWithCnpj = profiles.find(
      (profile) => String(profile?.establishmentId ?? '').replace(/\D/g, '').length === 14,
    );
    establishmentId = profileWithCnpj?.establishmentId
      ? String(profileWithCnpj.establishmentId).replace(/\D/g, '')
      : null;
  }

  let crt = emitente.crt ?? emitente.CRT ?? null;
  if (crt == null && establishmentId) {
    const company = await getCompanyFiscalProfile({ tenantId, establishmentId });
    crt = company?.crt ?? null;
  }
  crt = crt ?? 1;

  let itemSource = ITEM_SOURCE.THIRD_PARTY;
  let priorStStatus = PRIOR_ST_STATUS.UNKNOWN;
  const productProfile = await getProductFiscalProfile({ tenantId, productId: catalogProductId });
  if (productProfile?.itemSource) itemSource = productProfile.itemSource;
  if (productProfile?.priorStStatus) priorStStatus = productProfile.priorStStatus;

  const context = buildFiscalContextV31({
    emitente: {
      ...emitente,
      crt,
      uf: originUf,
      cpfCnpj: emitenteCnpj || null,
      establishmentId,
      businessTypeHint: input.businessType ?? null,
    },
    destinatario: {
      ...destinatario,
      uf: destinationUf,
    },
    produto: {
      ncm: item.ncm,
      descricao: item.descricao,
      unidade: item.unidade,
      produtoCatalogoId: catalogProductId,
      id: catalogProductId,
    },
    item: { itemSource },
    estoque: {
      priorStStatus,
      origemMercadoria: '0',
    },
    operacao: { tipo: 'VENDA' },
  });
  context.empresaId = tenantId;
  context.produto = {
    ...context.produto,
    produtoCatalogoId: catalogProductId,
    id: catalogProductId,
  };

  const allRules = input.approvedRulesCache
    ?? await loadAccountantApprovedRulesForTenant(tenantId);
  const scopedRules = establishmentId
    ? filterAccountantRulesForEstablishment(allRules, establishmentId, { requireExact: true })
    : allRules;
  const approvedRules = dedupeApprovedAccountantRulesForEmit(scopedRules);

  const matchingFacts = await enrichMatchingFactsForContext(context);
  const match = resolveAccountantApprovedFiscalRule(context, approvedRules, { matchingFacts });

  if (match.status !== APPROVED_RULE_MATCH_STATUS.MATCHED || !match.rule) {
    return null;
  }

  const legacyCfopCsosnOnly = input.legacyCfopCsosnOnly !== false;
  if (!legacyCfopCsosnOnly) {
    const capability = evaluateAccountantRuleEngineCapability(match.rule);
    if (!capability.executable) return null;
  }

  const approvedResult = getApprovedResultFromRule(match.rule);
  const cfop = approvedResult.cfop;
  const csosn = approvedResult.csosn;
  if (!cfop || !csosn) return null;

  const csosnStr = String(csosn);
  return {
    cfop: String(cfop),
    csosn: csosnStr,
    has_st: false,
    cest: item.cest ?? null,
  };
};
