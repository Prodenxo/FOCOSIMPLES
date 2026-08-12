/**
 * Hook de roteamento authoritative — integrado ao boundary de emissão.
 */
import { evaluateAuthoritativeEmissionRouting } from './authoritative-emission-orchestrator.js';
import { AUTHORITY_ENGINE, AUTHORITATIVE_ELIGIBLE_DOCUMENT_TYPES } from '../rollout/rollout-constants.js';

export { prepareFiscalAuthorityRouting, resolveNfeEmitPayloadForPlugnotas } from './nfe-emit-authority-integration.js';

/**
 * @param {object} params
 * @deprecated Prefer prepareFiscalAuthorityRouting / resolveNfeEmitPayloadForPlugnotas
 */
export const evaluateAuthorityRoutingForEmit = async (params) => {
  const documentType = String(params.documentType ?? '').trim().toUpperCase();
  if (!AUTHORITATIVE_ELIGIBLE_DOCUMENT_TYPES.includes(documentType)) {
    return {
      route: AUTHORITY_ENGINE.LEGACY,
      skipped: true,
      reason: 'DOCUMENT_NOT_ELIGIBLE',
    };
  }

  try {
    return await evaluateAuthoritativeEmissionRouting({
      empresaId: params.empresaId ?? params.userId,
      userId: params.userId,
      documentType,
      legacyPayload: params.legacyPayload,
      idIntegracao: params.idIntegracao,
      meiNotaRecordId: params.meiNotaRecordId,
      emissionAttemptId: params.emissionAttemptId,
      correlationId: params.correlationId ?? params.idIntegracao,
      metadata: params.metadata,
      businessType: params.businessType,
      inMemoryLotsByProduct: params.inMemoryLotsByProduct,
      lotFetcher: params.lotFetcher,
    });
  } catch (error) {
    console.warn('[fiscal-v3] authority routing fail-open:', error instanceof Error ? error.message : error);
    return {
      route: AUTHORITY_ENGINE.LEGACY,
      failOpen: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
