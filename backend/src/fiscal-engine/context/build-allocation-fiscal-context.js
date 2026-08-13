/**
 * Fase 4 — FiscalContext auditável por FiscalItemAllocation (Fase 3).
 * Fatos conhecidos apenas — sem CFOP/CSOSN/currentOperationSt resolvido.
 */
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { buildFiscalContextV31 } from './build-fiscal-context.js';
import { buildPreResolutionAllocationContext } from '../allocation/stock-allocation-builder.js';
import { buildFiscalEngineMetadata } from '../types/nfe-technical-profile.js';
import { ORIGEM_FISCAL_SOURCE, ORIGEM_FISCAL_SOURCE_PRECEDENCE } from '../types/origem-mercadoria.js';
import { CURRENT_OPERATION_ST, PRIOR_ST_STATUS } from '../types/st-allocation.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  deriveResolutionStatusFromIssues,
  RESOLUTION_STATUS,
} from '../types/resolution-status.js';
import { normalizeCrt, getCrtProfile } from '../types/crt.js';
import { toDecimal } from '../money/decimal.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);
const normalizeUf = (value) => String(value ?? '').trim().toUpperCase().slice(0, 2);

const VALID_ORIGEM_SOURCES = new Set(Object.values(ORIGEM_FISCAL_SOURCE));

/**
 * @param {unknown} value
 * @returns {keyof typeof ORIGEM_FISCAL_SOURCE | null}
 */
const normalizeOrigemSource = (value) => {
  const v = String(value ?? '').trim().toUpperCase();
  return VALID_ORIGEM_SOURCES.has(v) ? /** @type {keyof typeof ORIGEM_FISCAL_SOURCE} */ (v) : null;
};

/**
 * @param {object} row
 */
const normalizeAllocationRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id ?? null,
    empresaId: row.empresa_id ?? row.empresaId ?? null,
    stockLotId: row.stock_lot_id ?? row.stockLotId ?? null,
    produtoCatalogoId: row.produto_catalogo_id ?? row.produtoCatalogoId ?? null,
    quantidade: row.quantidade ?? null,
    origemMercadoria: row.origem_mercadoria ?? row.origemMercadoria ?? 'UNKNOWN',
    origemMercadoriaSource: row.origem_mercadoria_source ?? row.origemSource ?? null,
    priorStStatus: row.prior_st_status ?? row.priorStStatus ?? PRIOR_ST_STATUS.UNKNOWN,
    priorStEvidence: row.prior_st_evidence_json ?? row.priorStEvidence ?? {},
    supplierCest: row.supplier_cest ?? row.supplierCest ?? null,
    stockUnitResolution: row.stock_unit_resolution_json ?? row.stockUnitResolution ?? {},
    baseUnit: row.base_unit ?? row.baseUnit ?? 'UN',
    purchaseInvoiceId: row.purchase_invoice_id ?? row.purchaseInvoiceId ?? null,
    purchaseItemId: row.purchase_item_id ?? row.purchaseItemId ?? null,
    stRetainedAllocation: row.st_allocation_json ?? row.stRetainedAllocation ?? null,
    allocationAudit: row.allocation_audit_json ?? row.allocationAudit ?? {},
    allocationRequestUuid: row.allocation_request_uuid ?? row.allocationRequestUuid ?? null,
    commercialSaleId: row.commercial_sale_id ?? row.commercialSaleId ?? null,
    commercialSaleItemId: row.commercial_sale_item_id ?? row.commercialSaleItemId ?? null,
  };
};

/**
 * Evidência explícita de que o código origem veio do XML da compra — refs de purchase não bastam.
 * @param {ReturnType<typeof normalizeAllocationRow>} allocation
 * @param {object} inputHints
 */
const hasPurchaseXmlOrigemEvidence = (allocation, inputHints = {}) => (
  allocation.allocationAudit?.origemFromPurchaseXml === true
  || allocation.priorStEvidence?.origemFromPurchaseXml === true
  || allocation.allocationAudit?.purchaseXmlOrigemConfirmed === true
  || allocation.priorStEvidence?.purchaseXmlOrigemConfirmed === true
  || allocation.priorStEvidence?.origemFromXml === true
  || inputHints.stockLot?.origem_from_purchase_xml === true
  || inputHints.stockLot?.origemFromPurchaseXml === true
);

/**
 * @typedef {object} OrigemProvenanceCandidate
 * @property {keyof typeof ORIGEM_FISCAL_SOURCE} source
 * @property {string} evidenceRef
 * @property {string} provenance
 */

/**
 * @param {ReturnType<typeof normalizeAllocationRow>} allocation
 * @param {object} inputHints
 * @returns {OrigemProvenanceCandidate[]}
 */
const collectOrigemProvenanceCandidates = (allocation, inputHints = {}) => {
  /** @type {OrigemProvenanceCandidate[]} */
  const candidates = [];

  const pushExplicit = (value, evidenceRef) => {
    const source = normalizeOrigemSource(value);
    if (source && source !== ORIGEM_FISCAL_SOURCE.UNKNOWN) {
      candidates.push({ source, evidenceRef, provenance: 'explicit' });
    }
  };

  pushExplicit(allocation.origemMercadoriaSource, 'fiscalItemAllocation.origem_mercadoria_source');
  pushExplicit(allocation.allocationAudit?.origemSource, 'allocation_audit_json.origemSource');
  pushExplicit(allocation.priorStEvidence?.origemSource, 'prior_st_evidence_json.origemSource');
  pushExplicit(inputHints.stockLot?.origem_mercadoria_source, 'stockLot.origem_mercadoria_source');
  pushExplicit(inputHints.stockLot?.origemSource, 'stockLot.origemSource');
  pushExplicit(inputHints.origemProvenance?.source, 'origemProvenance.source');

  if (allocation.allocationAudit?.lotOrigemConfirmed === true
    || allocation.priorStEvidence?.lotOrigemConfirmed === true) {
    candidates.push({
      source: ORIGEM_FISCAL_SOURCE.LOT_CONFIRMED,
      evidenceRef: 'lotOrigemConfirmed',
      provenance: 'lot_confirmed_evidence',
    });
  }

  if (hasPurchaseXmlOrigemEvidence(allocation, inputHints)) {
    candidates.push({
      source: ORIGEM_FISCAL_SOURCE.PURCHASE_XML_CONFIRMED,
      evidenceRef: 'purchase_xml_origem_evidence',
      provenance: 'purchase_xml_evidence',
    });
  }

  if (allocation.allocationAudit?.manualOrigemConfirmed === true
    || allocation.priorStEvidence?.manualOrigemConfirmed === true) {
    candidates.push({
      source: ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION,
      evidenceRef: 'manualOrigemConfirmed',
      provenance: 'manual_confirmed_evidence',
    });
  }

  return candidates;
};

/**
 * @param {OrigemProvenanceCandidate[]} candidates
 * @returns {OrigemProvenanceCandidate | null}
 */
const pickOrigemProvenanceByPrecedence = (candidates) => {
  const list = Array.isArray(candidates) ? candidates : [];
  for (const level of ORIGEM_FISCAL_SOURCE_PRECEDENCE) {
    if (level === ORIGEM_FISCAL_SOURCE.UNKNOWN) continue;
    const match = list.find((c) => c.source === level);
    if (match) return match;
  }
  return null;
};

/**
 * Resolve proveniência da origem — precedência:
 * LOT_CONFIRMED > PURCHASE_XML_CONFIRMED > MANUAL_FISCAL_CONFIRMATION > UNKNOWN
 * @param {ReturnType<typeof normalizeAllocationRow>} allocation
 * @param {object} [inputHints]
 */
export const resolveOrigemProvenanceFromAllocation = (allocation, inputHints = {}) => {
  if (!allocation) {
    return {
      origemSource: ORIGEM_FISCAL_SOURCE.UNKNOWN,
      evidenceRef: null,
      provenance: 'missing_allocation',
    };
  }

  if (!allocation.origemMercadoria || allocation.origemMercadoria === 'UNKNOWN') {
    return {
      origemSource: ORIGEM_FISCAL_SOURCE.UNKNOWN,
      evidenceRef: 'fiscalItemAllocation.origem_mercadoria',
      provenance: 'value_unknown',
    };
  }

  const winner = pickOrigemProvenanceByPrecedence(
    collectOrigemProvenanceCandidates(allocation, inputHints),
  );

  if (winner) {
    return {
      origemSource: winner.source,
      evidenceRef: winner.evidenceRef,
      provenance: winner.provenance,
    };
  }

  return {
    origemSource: ORIGEM_FISCAL_SOURCE.UNKNOWN,
    evidenceRef: 'fiscalItemAllocation.origem_mercadoria',
    provenance: 'unattributed_known_value',
  };
};

/**
 * @param {object} operacaoRaw
 * @param {object} destRaw
 */
export const resolveCanonicalDestinationUf = (operacaoRaw = {}, destRaw = {}) => {
  const operationUf = normalizeUf(
    operacaoRaw.destinationUf ?? operacaoRaw.destination_uf,
  ) || null;
  const recipientUf = normalizeUf(
    destRaw.uf ?? destRaw.endereco?.estado ?? destRaw.endereco?.uf,
  ) || null;

  const issues = [];
  let canonicalDestinationUf = null;
  let destinationUfSource = null;

  if (operationUf && recipientUf && operationUf !== recipientUf) {
    issues.push(createFiscalIssue(
      'RULE_CONFLICT',
      'operation.destinationUf diverge de recipient.uf — localização não pode ser inferida silenciosamente.',
      { meta: { operationDestinationUf: operationUf, recipientUf } },
    ));
  } else if (operationUf) {
    canonicalDestinationUf = operationUf;
    destinationUfSource = 'OPERATION_INPUT';
  } else if (recipientUf) {
    canonicalDestinationUf = recipientUf;
    destinationUfSource = 'RECIPIENT_FALLBACK';
  }

  return {
    canonicalDestinationUf,
    destinationUfSource,
    operationUf,
    recipientUf,
    issues,
  };
};

/**
 * @param {string | null} issuerUf
 * @param {string | null} canonicalDestinationUf
 */
export const resolveOperationLocation = (issuerUf, canonicalDestinationUf) => {
  if (!issuerUf || !canonicalDestinationUf) return 'UNKNOWN';
  return issuerUf === canonicalDestinationUf ? 'INTERNA' : 'INTERESTADUAL';
};

/**
 * @typedef {object} BuildFiscalContextFromAllocationInput
 * @property {string} empresaId
 * @property {string} [commercialSaleId]
 * @property {string} [commercialSaleItemId]
 * @property {object} fiscalItemAllocation
 * @property {object} [issuer]
 * @property {object} [emitente]
 * @property {object} [recipient]
 * @property {object} [destinatario]
 * @property {object} [produto]
 * @property {object} [item]
 * @property {object} [operation]
 * @property {object} [operacao]
 * @property {object} [stockLot]
 * @property {object} [origemProvenance]
 * @property {object} [nfeTechnicalProfileOverrides]
 * @property {string | Date} [referenceDate]
 * @property {string} [decisionId]
 */

/**
 * Monta FiscalContext completo para uma única FiscalItemAllocation.
 * @param {BuildFiscalContextFromAllocationInput} input
 */
export const buildFiscalContextFromAllocation = (input = {}) => {
  const allocation = normalizeAllocationRow(input.fiscalItemAllocation);
  const empresaId = String(input.empresaId ?? '').trim() || null;

  const issues = [];

  if (!allocation) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'fiscalItemAllocation é obrigatório para montar FiscalContext.',
      { meta: { field: 'fiscalItemAllocation' } },
    ));
    return {
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      metadata: buildFiscalEngineMetadata(input.nfeTechnicalProfileOverrides),
      empresaId,
      resolutionStatus: RESOLUTION_STATUS.ERROR,
      issues,
      contextIssues: issues,
      auditRefs: {},
      pendingTaxResolution: {
        cfop: null,
        csosn: null,
        cst: null,
        currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
        icmsGroup: null,
      },
    };
  }

  if (!empresaId || !allocation.empresaId || allocation.empresaId !== empresaId) {
    issues.push(createFiscalIssue(
      'CROSS_TENANT_ACCESS',
      'FiscalContext não pode combinar allocation e boundary de empresas distintas.',
      { meta: { empresaId, allocationEmpresaId: allocation.empresaId } },
    ));
  }

  const emitenteRaw = input.issuer ?? input.emitente ?? {};
  const destRaw = input.recipient ?? input.destinatario ?? {};
  const produtoRaw = input.produto && typeof input.produto === 'object' ? input.produto : {};
  const itemRaw = input.item && typeof input.item === 'object' ? input.item : {};
  const operacaoRaw = input.operation ?? input.operacao ?? {};

  const referenceDate = input.referenceDate instanceof Date
    ? input.referenceDate.toISOString().slice(0, 10)
    : String(input.referenceDate ?? operacaoRaw.referenceDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  const preResolution = buildPreResolutionAllocationContext(
    input.fiscalItemAllocation,
  );

  const origemProvenance = resolveOrigemProvenanceFromAllocation(allocation, {
    stockLot: input.stockLot,
    origemProvenance: input.origemProvenance,
  });

  const destinationResolution = resolveCanonicalDestinationUf(operacaoRaw, destRaw);
  issues.push(...destinationResolution.issues);

  const issuerUf = normalizeUf(
    emitenteRaw.uf ?? emitenteRaw.endereco?.estado ?? emitenteRaw.endereco?.uf,
  ) || null;

  const operationLocation = resolveOperationLocation(
    issuerUf,
    destinationResolution.canonicalDestinationUf,
  );

  const base = buildFiscalContextV31({
    decisionId: input.decisionId ?? null,
    dataOperacao: referenceDate,
    emitente: emitenteRaw,
    destinatario: destRaw,
    produto: {
      ...produtoRaw,
      defaultOrigemMercadoria: produtoRaw.defaultOrigemMercadoria ?? produtoRaw.defaultOrigem,
    },
    item: {
      ...itemRaw,
      quantidade: allocation.quantidade ?? itemRaw.quantidade ?? 1,
    },
    estoque: {
      stockLotId: allocation.stockLotId,
      origemMercadoria: allocation.origemMercadoria,
      priorStStatus: allocation.priorStStatus,
      priorStEvidence: allocation.priorStEvidence,
      purchaseInvoiceId: allocation.purchaseInvoiceId,
      purchaseItemId: allocation.purchaseItemId,
      stRetainedAllocation: allocation.stRetainedAllocation,
    },
    operacao: operacaoRaw,
    nfeTechnicalProfileOverrides: input.nfeTechnicalProfileOverrides,
  });

  issues.push(...base.contextIssues);

  if (!issuerUf) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'UF do emitente ausente ou inválida.',
      { meta: { field: 'issuer.uf' } },
    ));
  }

  if (!destinationResolution.recipientUf) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'UF do destinatário ausente ou inválida.',
      { meta: { field: 'recipient.uf' } },
    ));
  }

  const crt = normalizeCrt(emitenteRaw.crt ?? emitenteRaw.CRT ?? base.emitente.crt);
  const crtProfile = crt ? getCrtProfile(crt) : null;

  const catalogCest = produtoRaw.cest ?? produtoRaw.defaultCest ?? null;
  const supplierCest = allocation.supplierCest
    ? onlyDigits(allocation.supplierCest, 7)
    : null;

  const auditRefs = {
    allocationId: allocation.id,
    allocationRequestUuid: allocation.allocationRequestUuid,
    stockLotId: allocation.stockLotId,
    facts: {
      origem: {
        value: base.estoque.origemMercadoria,
        source: origemProvenance.origemSource,
        provenance: origemProvenance.provenance,
        evidenceRef: origemProvenance.evidenceRef,
      },
      priorStStatus: {
        value: base.estoque.priorStStatus,
        source: 'ACQUISITION_CLASSIFIER',
        evidenceRef: 'fiscalItemAllocation.prior_st_evidence_json',
        evidence: allocation.priorStEvidence,
      },
      supplierCest: supplierCest
        ? {
          value: supplierCest,
          source: 'PURCHASE_ACQUISITION',
          evidenceRef: 'fiscalItemAllocation.supplier_cest',
        }
        : null,
      catalogCest: catalogCest
        ? {
          value: onlyDigits(catalogCest, 7),
          source: 'PRODUCT_CATALOG',
          evidenceRef: 'produto.cest',
        }
        : null,
      itemSource: {
        value: base.item.itemSource,
        source: itemRaw.itemSourceEvidence ?? itemRaw.itemSourceSource ?? 'COMMERCIAL_ITEM_INPUT',
      },
      icmsTaxpayerStatus: {
        value: base.destinatario.icmsTaxpayerStatus,
        source: destRaw.icmsTaxpayerStatusSource ?? 'RECIPIENT_INPUT',
      },
      personType: {
        value: base.destinatario.personType,
        source: 'RECIPIENT_DOCUMENT',
        document: base.destinatario.cpfCnpj,
      },
      crt: {
        value: crt,
        profile: crtProfile,
        source: 'ISSUER_FISCAL_REGISTRATION',
      },
      location: {
        value: operationLocation,
        source: 'DERIVED',
        issuerUf,
        canonicalDestinationUf: destinationResolution.canonicalDestinationUf,
        destinationUfSource: destinationResolution.destinationUfSource,
        operationDestinationUf: destinationResolution.operationUf,
        recipientUf: destinationResolution.recipientUf,
      },
    },
    allocationAudit: allocation.allocationAudit,
    preResolutionAudit: preResolution.auditRefs,
  };

  const commercialSaleId = input.commercialSaleId ?? allocation.commercialSaleId ?? null;
  const commercialSaleItemId = input.commercialSaleItemId ?? allocation.commercialSaleItemId ?? null;

  const issuerDocument = onlyDigits(
    emitenteRaw.document ?? emitenteRaw.cnpj ?? emitenteRaw.cpfCnpj,
    14,
  ) || null;

  const context = {
    ...base,
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    metadata: buildFiscalEngineMetadata(input.nfeTechnicalProfileOverrides),
    technicalProfile: buildFiscalEngineMetadata(input.nfeTechnicalProfileOverrides).nfeTechnicalProfile,

    empresaId,
    commercialSaleId,
    commercialSaleItemId,
    allocationId: allocation.id,
    stockLotId: allocation.stockLotId,
    purchaseInvoiceId: allocation.purchaseInvoiceId,
    purchaseItemId: allocation.purchaseItemId,

    produto: {
      ...base.produto,
      produtoCatalogoId: allocation.produtoCatalogoId,
      cest: catalogCest ? onlyDigits(catalogCest, 7) : null,
      supplierCest,
      cestEvidence: allocation.priorStEvidence?.cestEvidence ?? produtoRaw.cestEvidence ?? null,
    },

    allocation: {
      quantity: allocation.quantidade,
      stockUnit: allocation.baseUnit,
      unitResolution: allocation.stockUnitResolution,
      origem: base.estoque.origemMercadoria,
      origemSource: origemProvenance.origemSource,
      origemProvenance: origemProvenance.provenance,
      origemEvidence: allocation.allocationAudit,
      priorStStatus: base.estoque.priorStStatus,
      priorStEvidence: base.estoque.priorStEvidence,
      stRetainedAllocation: base.estoque.stRetainedAllocation,
    },

    emitente: {
      ...base.emitente,
      crt,
      crtProfile,
      document: issuerDocument,
      uf: issuerUf,
    },

    operacao: {
      ...base.operacao,
      localizacao: operationLocation,
      destinationUf: destinationResolution.canonicalDestinationUf,
      destinationUfSource: destinationResolution.destinationUfSource,
      referenceDate,
      operationType: base.operacao.tipo,
      presenceIndicator: base.operacao.presencialidade,
      purpose: base.operacao.finalidadeNfe,
    },

    preResolutionContext: preResolution,

    pendingTaxResolution: {
      cfop: null,
      csosn: null,
      cst: null,
      currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
      icmsGroup: null,
    },

    fiscalExtensions: input.fiscalExtensions && typeof input.fiscalExtensions === 'object'
      ? { ...input.fiscalExtensions }
      : {},

    auditRefs,
    issues,
    contextIssues: issues,
    resolutionStatus: issues.some((i) => i.code === 'CROSS_TENANT_ACCESS')
      ? RESOLUTION_STATUS.ERROR
      : deriveResolutionStatusFromIssues(issues),
  };

  if (allocation.quantidade != null) {
    context.item.quantidade = allocation.quantidade;
    context.item.quantidadeDecimal = toDecimal(allocation.quantidade);
  }

  return context;
};

/**
 * Monta um FiscalContext distinto por allocation — nunca mergeia parcelas.
 * @param {BuildFiscalContextFromAllocationInput & { fiscalItemAllocations?: object[] }} input
 * @returns {ReturnType<typeof buildFiscalContextFromAllocation>[]}
 */
export const buildFiscalContextsFromAllocations = (input = {}) => {
  const rows = Array.isArray(input.fiscalItemAllocations)
    ? input.fiscalItemAllocations
    : (input.fiscalItemAllocation ? [input.fiscalItemAllocation] : []);

  return rows.map((fiscalItemAllocation) => buildFiscalContextFromAllocation({
    ...input,
    fiscalItemAllocation,
    fiscalItemAllocations: undefined,
  }));
};

/**
 * Prepara fatos para TaxTreatment futuro (Fases 5+6) — currentOperationSt permanece UNKNOWN.
 * @param {ReturnType<typeof buildFiscalContextFromAllocation>} context
 */
export const prepareTaxTreatmentInput = (context) => ({
  operationType: context.operacao?.operationType ?? context.operacao?.tipo ?? null,
  itemSource: context.item?.itemSource ?? null,
  location: context.operacao?.localizacao ?? null,
  recipientTaxpayerStatus: context.destinatario?.icmsTaxpayerStatus ?? null,
  priorStStatus: context.estoque?.priorStStatus ?? context.allocation?.priorStStatus ?? null,
  currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
  stScenarioKey: null,
  crt: context.emitente?.crt ?? null,
  resolved: false,
});
