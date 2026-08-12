/**
 * Hook de emissão NF-e — shadow mode fail-open (Fase 7A).
 * Disparado SOMENTE após emissão legada bem-sucedida (post-success).
 * Nunca altera payload; nunca bloqueia emissão; nunca lança para o fluxo legado.
 */
import {
  isFiscalEngineV3ShadowEnabled,
  assertShadowDoesNotAuthorizeEmission,
} from '../feature-flag.js';
import { runFiscalV3ShadowComparisonWithTimeout } from './run-fiscal-v3-shadow-comparison.js';
import { clonePayloadForShadow } from './clone-payload-for-shadow.js';
import { buildLegacyFiscalSnapshotsFromPayload } from './legacy-fiscal-snapshot.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { recordShadowComparisonMetrics } from './fiscal-shadow-metrics.js';
import { SHADOW_EXECUTION_STATUS } from './shadow-constants.js';
import { resolveShadowEmissionIdentity } from './shadow-emission-identity.js';

const logShadowSyncError = (error, meta = {}) => {
  console.warn('[fiscal-shadow] fail-open:', error instanceof Error ? error.message : error, meta);
};

const recordShadowHookError = (error, phase) => {
  recordShadowComparisonMetrics({
    executionStatus: SHADOW_EXECUTION_STATUS.ERROR,
    summary: { errors: 1 },
    items: [],
    executionIssues: [createFiscalIssue(
      'SHADOW_EXECUTION_ERROR',
      error instanceof Error ? error.message : String(error),
      { severity: 'INFO', blocksEmission: false, meta: { phase } },
    )],
  });
};

/**
 * Dispara shadow APÓS emissão legada bem-sucedida.
 * Snapshot síncrono do payload FINAL enviado; processamento async no clone.
 * @param {object} params
 */
export const triggerNfeEmissionShadowComparisonAfterSuccess = (params) => {
  try {
    if (!isFiscalEngineV3ShadowEnabled()) {
      return { triggered: false, reason: 'shadow_disabled' };
    }

    try {
      assertShadowDoesNotAuthorizeEmission();
    } catch (configError) {
      logShadowSyncError(configError, { phase: 'config' });
      recordShadowHookError(configError, 'config');
      return { triggered: false, reason: 'invalid_config' };
    }

    const livePayload = params.legacyPayload ?? params.finalLegacyPayload;
    if (!livePayload || typeof livePayload !== 'object') {
      return { triggered: false, reason: 'missing_payload' };
    }

    const shadowEmissionIdentity = resolveShadowEmissionIdentity({
      shadowEmissionIdentity: params.shadowEmissionIdentity,
      idIntegracao: params.idIntegracao ?? livePayload.idIntegracao,
      meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId,
      correlationId: params.correlationId ?? livePayload.idIntegracao,
    });

    if (!shadowEmissionIdentity) {
      return { triggered: false, reason: 'missing_emission_identity' };
    }

    const legacyPayloadSnapshot = clonePayloadForShadow(livePayload);
    const legacySnapshotsSync = buildLegacyFiscalSnapshotsFromPayload(legacyPayloadSnapshot);

    void runFiscalV3ShadowComparisonWithTimeout({
      userId: params.userId,
      empresaId: params.empresaId ?? params.userId ?? null,
      legacyPayloadSnapshot,
      legacySnapshotsSync,
      correlationId: shadowEmissionIdentity,
      shadowEmissionIdentity,
      idIntegracao: params.idIntegracao ?? livePayload.idIntegracao ?? shadowEmissionIdentity,
      meiNotaRecordId: params.meiNotaRecordId ?? params.metadata?.meiNotaRecordId ?? null,
      emissionStatus: params.emissionStatus ?? params.providerStatus ?? null,
      businessType: params.businessType ?? null,
      documentType: params.documentType ?? 'NFE',
      metadata: params.metadata ?? {},
      lotFetcher: params.lotFetcher ?? null,
      inMemoryLotsByProduct: params.inMemoryLotsByProduct ?? null,
      confirmShadowLedger: true,
    }).catch((error) => {
      logShadowSyncError(error, { phase: 'async' });
      recordShadowHookError(error, 'async');
    });

    return {
      triggered: true,
      reason: 'scheduled_after_success',
      legacyPayloadSnapshot,
      legacySnapshotsSync,
      shadowEmissionIdentity,
    };
  } catch (error) {
    logShadowSyncError(error, { phase: 'sync_boundary' });
    recordShadowHookError(error, 'sync_boundary');
    return {
      triggered: false,
      reason: 'sync_error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/** @deprecated Use triggerNfeEmissionShadowComparisonAfterSuccess — shadow só após emissão OK */
export const triggerNfeEmissionShadowComparison = triggerNfeEmissionShadowComparisonAfterSuccess;

export { clonePayloadForShadow, __forceShadowCloneErrorForTests } from './clone-payload-for-shadow.js';
