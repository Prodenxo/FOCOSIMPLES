/**
 * Persistência auditável de tentativas authoritative.
 */
import { randomUUID } from 'node:crypto';
import {
  insertEmissionAttemptMemory,
  updateEmissionAttemptMemory,
  findEmissionAttemptMemory,
  findEmissionAttemptsByMeiNotaMemory,
  findEmissionAttemptByIdIntegracaoMemory,
  __resetEmissionAttemptsMemoryForTests,
} from './emission-attempt-memory.repository.js';
import * as pgRepo from './emission-attempt.repository.js';
import { EMISSION_ATTEMPT_STATUS, AUTHORITY_ENGINE } from '../rollout/rollout-constants.js';
import { resolveEmissionStableId } from '../rollout/rollout-canary.js';
import {
  FISCAL_REPOSITORY_MODE,
  isFiscalEnginePostgresEnabled,
  __setFiscalRepositoryModeForTests,
  __resetFiscalRepositoryModeForTests,
} from '../config/fiscal-repository-mode.js';

/** @internal */
export const __setEmissionAttemptPostgresEnabledForTests = (enabled) => {
  __setFiscalRepositoryModeForTests(
    enabled ? FISCAL_REPOSITORY_MODE.POSTGRES : FISCAL_REPOSITORY_MODE.MEMORY,
  );
};

/** @internal */
export const __resetEmissionAttemptServiceForTests = () => {
  __resetFiscalRepositoryModeForTests();
  __resetEmissionAttemptsMemoryForTests();
};

const isCriticalAuthoritativeAttempt = (row) => {
  const engine = row.authorityEngine ?? row.authorityDecision?.engine;
  return engine === AUTHORITY_ENGINE.V3
    || engine === AUTHORITY_ENGINE.BLOCKED
    || row.authorityDecision?.v3Candidate === true
    || row.authorityDecision?.authoritativeFiscalBlocked === true;
};

/**
 * @param {object} params
 */
export const persistAuthorityRoutingAttempt = async (params) => {
  const attemptId = params.attemptId ?? `auth-${randomUUID()}`;
  const row = {
    attemptId,
    empresaId: params.empresaId,
    establishmentId: params.establishmentId
      ?? params.authorityDecision?.establishmentId
      ?? null,
    meiNotaRecordId: params.meiNotaRecordId ?? null,
    idIntegracao: params.idIntegracao ?? null,
    emissionStableId: resolveEmissionStableId(params),
    documentType: params.documentType ?? 'NFE',
    authorityEngine: params.authorityDecision?.engine ?? AUTHORITY_ENGINE.LEGACY,
    rolloutMode: params.authorityDecision?.rolloutMode ?? null,
    canarySelected: params.authorityDecision?.canarySelected ?? null,
    attemptStatus: params.attemptStatus ?? EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY,
    preflightId: params.authorityDecision?.preflightId ?? null,
    allocationRequestIds: params.allocationRequestIds ?? [],
    candidatePayloadHash: params.candidatePayloadHash ?? null,
    authorityDecision: params.authorityDecision ?? {},
    preflightResult: params.preflightResult ?? {},
    issues: params.issues ?? params.authorityDecision?.issues ?? [],
    engineVersion: params.authorityDecision?.engineVersion ?? '3.1.0',
  };

  const critical = isCriticalAuthoritativeAttempt(row);

  try {
    if (isFiscalEnginePostgresEnabled()) {
      await pgRepo.insertEmissionAttemptPg(row);
    } else {
      insertEmissionAttemptMemory(row);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (critical && isFiscalEnginePostgresEnabled()) {
      throw new Error(`FISCAL_EMISSION_ATTEMPT_PERSIST_FAILED: ${message}`);
    }
    console.warn('[fiscal-v3] emission attempt persist fail-open:', message);
  }

  return { attemptId, row };
};

export const updateEmissionAttempt = async (attemptId, patch) => {
  const existing = await findEmissionAttemptById(attemptId);
  const critical = isCriticalAuthoritativeAttempt({ ...existing, ...patch });

  try {
    if (isFiscalEnginePostgresEnabled()) {
      await pgRepo.updateEmissionAttemptPg(attemptId, patch);
    } else {
      updateEmissionAttemptMemory(attemptId, patch);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (critical && isFiscalEnginePostgresEnabled()) {
      throw new Error(`FISCAL_EMISSION_ATTEMPT_UPDATE_FAILED: ${message}`);
    }
    console.warn('[fiscal-v3] emission attempt update fail-open:', message);
  }
};

export const findEmissionAttempt = async (attemptId) => findEmissionAttemptById(attemptId);

export const findEmissionAttemptById = async (attemptId) => {
  if (isFiscalEnginePostgresEnabled()) {
    return pgRepo.findEmissionAttemptPg(attemptId);
  }
  return findEmissionAttemptMemory(attemptId);
};

export const findEmissionAttemptByIdIntegracao = async (empresaId, idIntegracao) => {
  if (isFiscalEnginePostgresEnabled()) {
    return pgRepo.findEmissionAttemptByIdIntegracaoPg(empresaId, idIntegracao);
  }
  return findEmissionAttemptByIdIntegracaoMemory(empresaId, idIntegracao);
};

export const findEmissionAttemptsByMeiNotaRecordId = async (empresaId, meiNotaRecordId) => {
  if (isFiscalEnginePostgresEnabled()) {
    return pgRepo.findEmissionAttemptsByMeiNotaPg(empresaId, meiNotaRecordId);
  }
  return findEmissionAttemptsByMeiNotaMemory(empresaId, meiNotaRecordId);
};

export { hashPayloadForAudit } from './emission-attempt.repository.js';
