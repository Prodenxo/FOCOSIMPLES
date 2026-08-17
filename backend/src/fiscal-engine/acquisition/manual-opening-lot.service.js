/**
 * Service — estoque fiscal inicial confirmado pelo contador (Phase 8F.5).
 */
import { badRequest } from '../../utils/errors.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { deriveResolutionStatusFromIssues } from '../types/resolution-status.js';
import { createFiscalDecisionLogEntry } from '../audit/fiscal-decision-log.js';
import { persistFiscalDecisionLog } from '../audit/fiscal-decision-log.repository.js';
import { validateCatalogProductForEmpresa } from './purchase-catalog.service.js';
import { normalizeEstablishmentIdFromEmitenteCpfCnpj } from '../establishment/fiscal-establishment-id.js';
import {
  validateManualOpeningLotInput,
  resolveManualOpeningLotStatus,
} from './manual-opening-lot.policy.js';
import { manualOpeningLotRepo } from './manual-opening-lot.repository.js';
import { FISCAL_LOT_SOURCE } from './manual-opening-lot.constants.js';

const resolveBaseUnitFromCatalogMetadata = (metadataJson) => {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return 'UN';
  const unidade = typeof metadataJson.unidade === 'string' ? metadataJson.unidade.trim() : '';
  return unidade || 'UN';
};

/**
 * @param {object} params
 */
export const createManualFiscalOpeningLot = async ({
  tenantId,
  establishmentId,
  produtoCatalogoId,
  quantidade,
  origemMercadoria,
  priorStStatus,
  observacao = null,
  confirmationRequestId = null,
  actorUserId,
  payloadActorUserId = null,
}) => {
  const normalizedEstablishment = normalizeEstablishmentIdFromEmitenteCpfCnpj(establishmentId);
  if (!normalizedEstablishment) {
    throw badRequest('establishmentId inválido');
  }

  const validation = validateManualOpeningLotInput({
    tenantId,
    establishmentId: normalizedEstablishment,
    produtoCatalogoId,
    quantidade,
    origemMercadoria,
    priorStStatus,
    actorUserId,
    payloadActorUserId,
  });
  if (!validation.ok) {
    const err = badRequest(validation.issues[0]?.message || 'Entrada manual inválida');
    err.fiscalIssues = validation.issues;
    throw err;
  }

  if (confirmationRequestId) {
    const existing = await manualOpeningLotRepo.findByConfirmationRequestId({
      tenantId,
      establishmentId: normalizedEstablishment,
      confirmationRequestId,
    });
    if (existing) {
      return { lot: existing, idempotentReplay: true, auditLogId: null };
    }
  }

  const catalogProduct = await validateCatalogProductForEmpresa({
    userId: actorUserId,
    empresaId: tenantId,
    produtoCatalogoId,
  });

  const metaFields = { unidade: resolveBaseUnitFromCatalogMetadata(catalogProduct?.metadata_json) };
  const baseUnit = metaFields.unidade;

  const status = resolveManualOpeningLotStatus({
    tenantId,
    establishmentId: normalizedEstablishment,
    produtoCatalogoId,
    quantidade,
    origemMercadoria,
    priorStStatus,
    actorUserId,
    baseUnit,
  });
  if (status !== 'USABLE') {
    const issues = [createFiscalIssue('REQUIRED_FIELD_MISSING', 'Lote manual não elegível para USABLE')];
    throw badRequest('Lote manual não elegível para USABLE', { fiscalIssues: issues });
  }

  const lot = await manualOpeningLotRepo.insert({
    tenantId,
    establishmentId: normalizedEstablishment,
    produtoCatalogoId,
    quantidade,
    origemMercadoria,
    priorStStatus: String(priorStStatus).trim().toUpperCase(),
    createdByUserId: actorUserId,
    observacao,
    confirmationRequestId,
    baseUnit,
  });

  const auditEntry = createFiscalDecisionLogEntry({
    decisionId: lot.id,
    contextSnapshot: {
      event: 'MANUAL_FISCAL_OPENING_LOT',
      tenantId,
      establishmentId: normalizedEstablishment,
      produtoCatalogoId,
      lotId: lot.id,
      origemMercadoria,
      priorStStatus,
      quantidade,
      lotSource: FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION,
    },
    automaticResult: { lotId: lot.id, status: lot.status },
    issues: [],
  });

  const persisted = await persistFiscalDecisionLog({
    empresaId: tenantId,
    userId: actorUserId,
    status: auditEntry.status,
    contextSnapshot: auditEntry.contextSnapshot,
    automaticResult: auditEntry.automaticResult,
    issues: auditEntry.issues,
    auditJson: {
      event: 'MANUAL_FISCAL_OPENING_LOT',
      lotSource: FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION,
    },
  });

  return {
    lot,
    idempotentReplay: false,
    auditLogId: persisted?.id ?? null,
    audit: auditEntry,
    resolutionStatus: deriveResolutionStatusFromIssues([]),
  };
};

/** @internal testes */
export const __resetManualOpeningLotServiceForTests = () => {
  manualOpeningLotRepo.__reset?.();
};
