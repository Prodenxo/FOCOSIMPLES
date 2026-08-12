/**
 * Preflight authoritative — estruturas isoladas, zero mutação do payload legado.
 */
import { randomUUID } from 'node:crypto';
import { clonePayloadForShadow } from '../shadow/clone-payload-for-shadow.js';
import { buildFiscalV3ShadowInput } from '../shadow/build-fiscal-v3-shadow-input.js';
import { resolveFiscalFromContext, resolveFiscalFromContexts } from '../resolution/resolve-fiscal-from-context.js';
import { crossValidateFiscalResolution } from '../validation/cross-validator.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { RESOLUTION_STATUS } from '../types/resolution-status.js';
import { buildFiscalContextFromAllocation } from '../context/build-allocation-fiscal-context.js';
import { deriveIcmsTaxpayerStatusFromLegacyDestinatario } from '../shadow/build-fiscal-v3-shadow-input.helpers.js';
import { parseItemSourceHint } from '../types/item-source.js';
import { toDecimal, sumDecimals, formatDecimal } from '../money/decimal.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';

const QTY_SCALE = 10;

const PREFLIGHT_BLOCKING_CODES = new Set([
  'RULE_CONFLICT',
  'RULE_NOT_PRODUCTION_READY',
  'ORIGIN_UNKNOWN',
  'CURRENT_ST_UNKNOWN',
  'ITEM_SOURCE_UNKNOWN',
  'ICMS_TAXPAYER_STATUS_UNKNOWN',
  'CROSS_TENANT_ACCESS',
  'INSUFFICIENT_USABLE_FISCAL_STOCK',
  'STOCK_ALLOCATION_CONFLICT',
  'FISCAL_COMBINATION_FORBIDDEN',
  'XML_INVALID',
  'REQUIRED_FIELD_MISSING',
  'UNSUPPORTED_SCENARIO',
]);

/**
 * @param {import('../types/fiscal-result.js').FiscalResult} result
 */
const collectPreflightIssues = (result) => {
  const issues = [...(result.issues ?? [])];
  const resolutions = result.resolutions ?? {};

  if (!resolutions.cfop) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'CFOP ausente no preflight authoritative'));
  }
  if (!resolutions.csosn && !resolutions.cst) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'CSOSN/CST ausente no preflight authoritative'));
  }
  if (result.context?.origemMercadoria?.code === 'UNKNOWN') {
    issues.push(createFiscalIssue('ORIGIN_UNKNOWN', 'Origem obrigatória UNKNOWN no preflight authoritative'));
  }
  if (result.treatment?.currentOperationSt === CURRENT_OPERATION_ST.UNKNOWN) {
    issues.push(createFiscalIssue('CURRENT_ST_UNKNOWN', 'currentST UNKNOWN quando resolução exigida'));
  }

  const icmsGroups = resolutions.xmlFields?.taxes?.icms
    ? [resolutions.xmlFields.taxes.icms]
    : (result.audit?.steps?.xmlFields?.icmsGroups ?? []);
  if (Array.isArray(icmsGroups) && icmsGroups.length > 1) {
    issues.push(createFiscalIssue('FISCAL_COMBINATION_FORBIDDEN', 'Mais de um grupo ICMS por item'));
  }

  return issues;
};

/**
 * @param {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 */
const isPreflightBlocked = (issues) => (
  issues.some((issue) => issue.blocksEmission === true
    || PREFLIGHT_BLOCKING_CODES.has(issue.code))
  || issues.some((issue) => issue.code === 'RULE_NOT_PRODUCTION_READY')
);

/**
 * Preflight read-only — planning sem reserva real.
 * @param {object} params
 */
export const runAuthoritativePreflightReadOnly = async (params) => {
  const preflightId = params.preflightId ?? `preflight-ro-${randomUUID()}`;
  const legacyPayloadSnapshot = clonePayloadForShadow(params.legacyPayload ?? {});

  const shadowInput = await buildFiscalV3ShadowInput({
    empresaId: params.empresaId,
    userId: params.userId,
    correlationId: params.correlationId,
    emissionAttemptId: params.emissionAttemptId,
    documentType: params.documentType,
    businessType: params.businessType,
    legacyPayloadSnapshot,
    metadata: params.metadata ?? {},
    inMemoryLotsByProduct: params.inMemoryLotsByProduct,
    lotFetcher: params.lotFetcher,
  });

  const fiscalResults = resolveFiscalFromContexts(shadowInput.fiscalContexts, {
    allowNonProductionRules: false,
  });

  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const allIssues = [...(shadowInput.planningIssues ?? [])];

  for (const plan of shadowInput.itemPlans ?? []) {
    if (!plan.plannedAllocations?.length || !plan.fiscalContexts?.length) {
      allIssues.push(createFiscalIssue(
        'INSUFFICIENT_USABLE_FISCAL_STOCK',
        'Preflight authoritative — allocation fiscal indisponível ou incompleta.',
        {
          severity: 'ERROR',
          blocksEmission: true,
          meta: { itemIndex: plan.itemIndex, produtoCatalogoId: plan.commercialItem?.produtoCatalogoId },
        },
      ));
    }
  }

  for (const result of fiscalResults) {
    allIssues.push(...collectPreflightIssues(result));
    if (result.resolutionStatus !== RESOLUTION_STATUS.OK) {
      allIssues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        `Preflight unresolved: ${result.resolutionStatus}`,
        { severity: 'ERROR', blocksEmission: true, meta: { resolutionStatus: result.resolutionStatus } },
      ));
    }
  }

  const blocked = isPreflightBlocked(allIssues) || fiscalResults.some((r) => r.blocked);

  return {
    preflightId,
    ok: !blocked,
    blocked,
    readOnly: true,
    legacyPayloadSnapshot,
    shadowInput,
    fiscalResults,
    issues: allIssues,
    itemPlans: shadowInput.itemPlans,
  };
};

/**
 * Monta FiscalContext pós-reserva com os mesmos enriquecimentos do shadow input.
 * @param {object} params
 */
const buildPostReservationFiscalContext = ({
  allocation,
  allocationGroup,
  params,
  legacyItens,
  referenceDate,
}) => {
  const emitente = params.emitente ?? params.legacyPayload?.emitente ?? {};
  const destinatarioRaw = params.destinatario ?? params.legacyPayload?.destinatario ?? {};
  const businessType = params.businessType ?? params.metadata?.businessType ?? null;
  const commercial = allocationGroup.commercialItem ?? {};
  const itemIndex = allocationGroup.commercialItemIndex ?? commercial.itemIndex ?? 0;
  const legacyItem = legacyItens[itemIndex] ?? legacyItens[0] ?? {};
  const itemSourceHint = parseItemSourceHint(
    businessType ?? legacyItem?.itemSource ?? legacyItem?.metadata?.businessType,
  );
  const icmsTaxpayerStatus = deriveIcmsTaxpayerStatusFromLegacyDestinatario(destinatarioRaw);
  const destUf = destinatarioRaw.endereco?.estado
    ?? destinatarioRaw.endereco?.uf
    ?? destinatarioRaw.uf;

  return buildFiscalContextFromAllocation({
    empresaId: params.empresaId ?? allocation.empresa_id ?? allocation.empresaId,
    commercialSaleId: commercial.commercialSaleId,
    commercialSaleItemId: commercial.commercialSaleItemId,
    fiscalItemAllocation: allocation,
    referenceDate,
    emitente: {
      crt: emitente.crt ?? emitente.CRT ?? params.metadata?.crt ?? 1,
      uf: emitente.endereco?.estado ?? emitente.endereco?.uf ?? emitente.uf,
      cnae: emitente.cnae ?? null,
      inscricaoEstadual: emitente.inscricaoEstadual ?? null,
      businessTypeHint: businessType,
    },
    destinatario: {
      cpfCnpj: destinatarioRaw.cpfCnpj,
      uf: destUf,
      icmsTaxpayerStatus,
      inscricaoEstadual: destinatarioRaw.inscricaoEstadual ?? null,
      indIEDest: destinatarioRaw.indIEDest ?? destinatarioRaw.indicadorInscricaoEstadual ?? null,
    },
    produto: {
      ncm: legacyItem.ncm ?? commercial.ncm,
      descricao: legacyItem.descricao ?? commercial.descricao,
      cest: legacyItem.cest ?? commercial.cest ?? null,
    },
    item: {
      itemSource: legacyItem.itemSource ?? itemSourceHint ?? undefined,
      valorUnitario: legacyItem.valorUnitario ?? commercial.valorUnitario ?? 0,
      valorTotal: legacyItem.valorTotal ?? commercial.valorTotal ?? null,
    },
    operation: {
      tipo: 'VENDA',
      destinationUf: destUf,
    },
    metadata: params.metadata ?? {},
  });
};

/**
 * Revalidação pós-reserva com allocations REAIS reservadas.
 * @param {object} params
 */
export const runAuthoritativePreflightPostReservation = async (params) => {
  const preflightId = params.preflightId ?? `preflight-post-${randomUUID()}`;
  const legacyPayloadSnapshot = clonePayloadForShadow(params.legacyPayload ?? {});
  const legacyItens = Array.isArray(params.legacyPayload?.itens) ? params.legacyPayload.itens : [];
  const referenceDate = String(params.metadata?.referenceDate ?? new Date().toISOString()).slice(0, 10);

  /** @type {object[]} */
  const fiscalContexts = [];
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const allIssues = [];

  for (const allocationGroup of params.reservedAllocations ?? []) {
    for (const allocation of allocationGroup.allocations ?? []) {
      fiscalContexts.push(buildPostReservationFiscalContext({
        allocation,
        allocationGroup,
        params,
        legacyItens,
        referenceDate,
      }));
    }
  }

  const fiscalResults = resolveFiscalFromContexts(fiscalContexts, {
    allowNonProductionRules: false,
  });

  for (const result of fiscalResults) {
    allIssues.push(...collectPreflightIssues(result));
    if (result.resolutionStatus !== RESOLUTION_STATUS.OK) {
      allIssues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        `Pós-reserva unresolved: ${result.resolutionStatus}`,
        { severity: 'ERROR', blocksEmission: true },
      ));
    }
  }

  const requestedQty = params.requestedQuantities ?? [];
  for (const req of requestedQty) {
    const allocated = sumDecimals(
      (params.reservedAllocations ?? [])
        .flatMap((g) => g.allocations ?? [])
        .filter((a) => a.commercial_sale_item_id === req.commercialSaleItemId
          || a.commercialSaleItemId === req.commercialSaleItemId)
        .map((a) => a.quantidade ?? '0'),
    );
    if (!toDecimal(allocated).eq(toDecimal(req.quantidade ?? '0'))) {
      allIssues.push(createFiscalIssue(
        'INSUFFICIENT_USABLE_FISCAL_STOCK',
        `Allocation incompleta pós-reserva — solicitado ${req.quantidade}, alocado ${formatDecimal(toDecimal(allocated), QTY_SCALE)}`,
        { severity: 'ERROR', blocksEmission: true },
      ));
    }
  }

  const blocked = isPreflightBlocked(allIssues) || fiscalResults.some((r) => r.blocked);

  return {
    preflightId,
    ok: !blocked,
    blocked,
    readOnly: false,
    legacyPayloadSnapshot,
    fiscalResults,
    fiscalContexts,
    issues: allIssues,
  };
};

/**
 * Garantia de imutabilidade — comparação estrutural shallow+JSON para testes.
 * @param {object} before
 * @param {object} after
 */
export const assertLegacyPayloadUnmutated = (before, after) => (
  JSON.stringify(before) === JSON.stringify(after)
);
