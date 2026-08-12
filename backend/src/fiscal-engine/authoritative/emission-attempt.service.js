/**
 * Persistência auditável de tentativas authoritative.
 */
import { randomUUID } from 'node:crypto';
import {
  insertEmissionAttemptMemory,
  updateEmissionAttemptMemory,
  findEmissionAttemptMemory,
  findEmissionAttemptsByMeiNotaMemory,
} from './emission-attempt-memory.repository.js';
import * as pgRepo from './emission-attempt.repository.js';
import { EMISSION_ATTEMPT_STATUS, AUTHORITY_ENGINE } from '../rollout/rollout-constants.js';
import { resolveEmissionStableId } from '../rollout/rollout-canary.js';

let usePostgres = false;

/** @internal */
export const __setEmissionAttemptPostgresEnabledForTests = (enabled) => {
  usePostgres = Boolean(enabled);
};

/** @internal */
export const __resetEmissionAttemptServiceForTests = () => {
  usePostgres = false;
};

/**
 * @param {object} params
 */
export const persistAuthorityRoutingAttempt = async (params) => {
  const attemptId = params.attemptId ?? `auth-${randomUUID()}`;
  const row = {
    attemptId,
    empresaId: params.empresaId,
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

  try {
    if (usePostgres) {
      await pgRepo.insertEmissionAttemptPg(row);
    } else {
      insertEmissionAttemptMemory(row);
    }
  } catch (error) {
    console.warn('[fiscal-v3] emission attempt persist fail-open:', error instanceof Error ? error.message : error);
  }

  return { attemptId, row };
};

export const updateEmissionAttempt = async (attemptId, patch) => {
  try {
    if (usePostgres) {
      await pgRepo.updateEmissionAttemptPg(attemptId, patch);
    } else {
      updateEmissionAttemptMemory(attemptId, patch);
    }
  } catch (error) {
    console.warn('[fiscal-v3] emission attempt update fail-open:', error instanceof Error ? error.message : error);
  }
};

export const findEmissionAttempt = (attemptId) => findEmissionAttemptMemory(attemptId);

export const findEmissionAttemptById = (attemptId) => findEmissionAttemptMemory(attemptId);

export const findEmissionAttemptsByMeiNotaRecordId = (empresaId, meiNotaRecordId) => (
  findEmissionAttemptsByMeiNotaMemory(empresaId, meiNotaRecordId)
);

export { hashPayloadForAudit } from './emission-attempt.repository.js';
