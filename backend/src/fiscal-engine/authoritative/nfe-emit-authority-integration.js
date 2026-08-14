/**
 * Integração authoritative no boundary de emissão NF-e/NFC-e.
 * TX1: reserve + PREPARED (commit in-memory/pg) → network → TX2: outcome reconcile.
 */
import { isFiscalEngineV3Enabled } from '../feature-flag.js';
import { AUTHORITY_ENGINE, AUTHORITY_DECISION_REASON, EMISSION_ATTEMPT_STATUS } from '../rollout/rollout-constants.js';
import { prepareAuthoritativeEmissionCandidate } from './authoritative-emission-orchestrator.js';
import {
  updateEmissionAttempt,
  hashPayloadForAudit,
  findEmissionAttemptById,
  findEmissionAttemptsByMeiNotaRecordId,
} from './emission-attempt.service.js';
import {
  classifyEmitRequestOutcome,
  resolveReservationTransition,
  applyReservationLifecycle,
} from './reservation-lifecycle.js';
import { REQUEST_OUTCOME } from '../rollout/rollout-constants.js';

/** Classificação das transformações em emitirNota (documentação + guard). */
export const NFE_EMIT_TRANSFORM_CLASS = Object.freeze({
  LEGACY_FISCAL: 'LEGACY_FISCAL',
  TECHNICAL: 'TECHNICAL',
  COMMERCIAL: 'COMMERCIAL',
  VALIDATION: 'VALIDATION',
});

/** Ordem documentada das etapas em emitirNota para NF-e. */
export const NFE_EMIT_PIPELINE_ORDER = Object.freeze([
  { step: 'buildPayloadByDocumentType', class: NFE_EMIT_TRANSFORM_CLASS.COMMERCIAL },
  { step: 'resolveIdIntegracaoForEmit', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
  { step: 'getBusinessTypeMirror', class: NFE_EMIT_TRANSFORM_CLASS.COMMERCIAL },
  { step: 'prepareFiscalAuthorityRouting', class: NFE_EMIT_TRANSFORM_CLASS.VALIDATION },
  { step: 'buildAuthoritativeNfePayloadFromFiscalResults', class: NFE_EMIT_TRANSFORM_CLASS.VALIDATION },
  { step: 'applyAuthoritativePlugnotasTributosBridge', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL, skipWhenV3: false },
  { step: 'recalculateNfeLikePayloadTaxForEmit', class: NFE_EMIT_TRANSFORM_CLASS.LEGACY_FISCAL, skipWhenV3: true },
  { step: 'validatePayloadByDocumentType', class: NFE_EMIT_TRANSFORM_CLASS.VALIDATION },
  { step: 'applyIbptTransparenciaToNfePayload', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
  { step: 'normalizePlugnotasNfePayload', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
  { step: 'hydrateMeiNfeEmitenteIeFromEmpresa', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
  { step: 'applyMeiNfeEmitForcePolicy', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
  { step: 'adapter.emitir', class: NFE_EMIT_TRANSFORM_CLASS.TECHNICAL },
]);

/**
 * Master switch OFF → LEGACY imediato sem pipeline fiscal pesado.
 * @param {object} params
 */
export const prepareFiscalAuthorityRouting = async (params) => {
  const commercialPayload = params.commercialPayload ?? params.legacyPayload ?? {};

  if (!isFiscalEngineV3Enabled()) {
    return {
      engine: AUTHORITY_ENGINE.LEGACY,
      payloadToEmit: commercialPayload,
      authorityDecision: {
        engine: AUTHORITY_ENGINE.LEGACY,
        reasons: [AUTHORITY_DECISION_REASON.MASTER_SWITCH_OFF],
      },
      skipAuthorityPipeline: true,
      attemptId: null,
      allocationRequestIds: [],
      authorityAssumed: false,
    };
  }

  const candidate = await prepareAuthoritativeEmissionCandidate({
    ...params,
    legacyPayload: commercialPayload,
  });

  if (candidate.route === AUTHORITY_ENGINE.BLOCKED || candidate.authoritativeFiscalBlocked) {
    return {
      engine: AUTHORITY_ENGINE.BLOCKED,
      blocked: true,
      payloadToEmit: commercialPayload,
      authorityDecision: candidate.authorityDecision,
      attemptId: candidate.attemptId ?? null,
      allocationRequestIds: [],
      authorityAssumed: false,
      authoritativeFiscalBlocked: true,
      legacyFiscalApplied: false,
      preflight: candidate.preflight ?? null,
      issues: candidate.authorityDecision?.issues ?? [],
    };
  }

  if (candidate.route === AUTHORITY_ENGINE.V3 && candidate.authorityAssumed && candidate.candidatePayload) {
    await updateEmissionAttempt(candidate.attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.PREPARED,
      candidatePayloadHash: hashPayloadForAudit(candidate.candidatePayload),
      allocationRequestIds: candidate.allocationRequestIds,
      idIntegracao: params.idIntegracao ?? commercialPayload.idIntegracao ?? null,
      meiNotaRecordId: params.meiNotaRecordId ?? null,
    });

    return {
      engine: AUTHORITY_ENGINE.V3,
      payloadToEmit: candidate.candidatePayload,
      authoritativePayload: candidate.candidatePayload,
      authorityDecision: candidate.authorityDecision,
      attemptId: candidate.attemptId,
      allocationRequestIds: candidate.allocationRequestIds ?? [],
      authorityAssumed: true,
      preflight: candidate.postPreflight,
      candidateAudit: candidate.candidateAudit,
    };
  }

  return {
    engine: AUTHORITY_ENGINE.LEGACY,
    payloadToEmit: commercialPayload,
    authorityDecision: candidate.authorityDecision ?? {
      engine: AUTHORITY_ENGINE.LEGACY,
      reasons: [AUTHORITY_DECISION_REASON.AUTHORITATIVE_NOT_ELIGIBLE],
    },
    attemptId: candidate.attemptId ?? null,
    allocationRequestIds: [],
    authorityAssumed: false,
    authoritativeNotEligible: candidate.authoritativeNotEligible ?? false,
    legacyFiscalApplied: false,
  };
};

/**
 * Resolve payload final para PlugNotas — ponto testável do boundary.
 * @param {object} params
 */
export const resolveNfeEmitPayloadForPlugnotas = async (params) => {
  const commercialPayload = params.commercialPayload ?? {};

  const routing = await prepareFiscalAuthorityRouting({
    ...params,
    commercialPayload,
  });

  if (routing.engine === AUTHORITY_ENGINE.BLOCKED || routing.blocked) {
    return {
      ...routing,
      payloadToEmit: commercialPayload,
      legacyFiscalApplied: false,
      blocked: true,
    };
  }

  if (routing.engine === AUTHORITY_ENGINE.V3) {
    const payloadToEmit = params.applyTechnicalTransforms
      ? await params.applyTechnicalTransforms(routing.payloadToEmit, { authorityV3: true })
      : routing.payloadToEmit;
    return {
      ...routing,
      payloadToEmit,
      legacyFiscalApplied: false,
    };
  }

  let payload = commercialPayload;
  if (params.applyLegacyFiscalTransform) {
    payload = await params.applyLegacyFiscalTransform(commercialPayload);
  }
  if (params.applyTechnicalTransforms) {
    payload = await params.applyTechnicalTransforms(payload, { authorityV3: false });
  }

  return {
    ...routing,
    payloadToEmit: payload,
    legacyFiscalApplied: true,
  };
};

/**
 * TX2 — pós-network (fora de transaction de reserva).
 * @param {object} params
 */
export const handleAuthoritativeEmitOutcome = async (params) => {
  const attemptId = params.attemptId;
  if (!attemptId) return { handled: false };

  const attempt = findEmissionAttemptById(attemptId);
  if (!attempt || attempt.authorityEngine !== AUTHORITY_ENGINE.V3) {
    return { handled: false };
  }

  const outcome = params.requestOutcome
    ?? (params.error ? classifyEmitRequestOutcome(params.error) : REQUEST_OUTCOME.SUCCESS);
  const providerStatus = params.providerStatus ?? params.emissionStatus ?? null;
  const sentToProvider = params.sentToProvider === true;

  const transition = resolveReservationTransition({
    requestOutcome: outcome,
    providerStatus,
    sentToProvider,
  });

  if (outcome === REQUEST_OUTCOME.NETWORK_ERROR || outcome === REQUEST_OUTCOME.UNKNOWN) {
    await updateEmissionAttempt(attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.REQUEST_OUTCOME_UNKNOWN,
      idIntegracao: params.idIntegracao ?? attempt.idIntegracao,
      meiNotaRecordId: params.meiNotaRecordId ?? attempt.meiNotaRecordId,
    });
  } else if (outcome === REQUEST_OUTCOME.REJECTED) {
    await updateEmissionAttempt(attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.REJECTED,
      meiNotaRecordId: params.meiNotaRecordId ?? attempt.meiNotaRecordId,
      idIntegracao: params.idIntegracao ?? attempt.idIntegracao,
    });
  } else if (outcome === REQUEST_OUTCOME.SUCCESS) {
    const normalized = String(providerStatus ?? '').toLowerCase();
    const isProcessing = normalized.includes('process') || normalized === 'processando';
    await updateEmissionAttempt(attemptId, {
      attemptStatus: isProcessing ? EMISSION_ATTEMPT_STATUS.EMITTED : EMISSION_ATTEMPT_STATUS.EMITTED,
      meiNotaRecordId: params.meiNotaRecordId ?? attempt.meiNotaRecordId,
      idIntegracao: params.idIntegracao ?? attempt.idIntegracao,
      providerStatus: normalized || null,
    });
  }

  const allocationRequestIds = params.allocationRequestIds
    ?? attempt.allocationRequestIds
    ?? [];

  const results = [];
  for (const reqId of allocationRequestIds) {
    if (outcome === REQUEST_OUTCOME.SUCCESS && !transition.consumeReservation && !transition.releaseReservation) {
      results.push({ allocationRequestId: reqId, held: true });
      continue;
    }
    const result = await applyReservationLifecycle(
      params.empresaId ?? attempt.empresaId,
      reqId,
      transition,
    );
    results.push({ allocationRequestId: reqId, result, transition });
  }

  return { handled: true, outcome, transition, results, attemptId };
};

/**
 * Reconciliação pós-sync PlugNotas (processando → terminal).
 * Kill-switch OFF não impede reconciliação de attempts anteriores.
 * @param {object} params
 */
export const reconcileAuthoritativeAttemptOnMeiNotaStatusChange = async (params) => {
  const meiNotaRecordId = params.meiNotaRecordId ?? null;
  const empresaId = params.empresaId ?? params.userId ?? null;
  if (!meiNotaRecordId || !empresaId) {
    return { reconciled: false, reason: 'missing_identity' };
  }

  const attempts = findEmissionAttemptsByMeiNotaRecordId(empresaId, meiNotaRecordId)
    .filter((a) => a.authorityEngine === AUTHORITY_ENGINE.V3);

  if (!attempts.length) {
    return { reconciled: false, reason: 'no_authoritative_attempt' };
  }

  const newStatus = String(params.newStatus ?? '').toLowerCase();
  const previousStatus = String(params.previousStatus ?? '').toLowerCase();
  if (previousStatus === newStatus) {
    return { reconciled: false, reason: 'status_unchanged' };
  }

  let requestOutcome = REQUEST_OUTCOME.UNKNOWN;
  if (newStatus.includes('conclu') || newStatus === 'autorizada') {
    requestOutcome = REQUEST_OUTCOME.SUCCESS;
  } else if (newStatus.includes('rejeit') || newStatus === 'cancelado' || newStatus === 'interrompido') {
    requestOutcome = REQUEST_OUTCOME.REJECTED;
  }

  const results = [];
  for (const attempt of attempts) {
    if ([EMISSION_ATTEMPT_STATUS.CONSUMED, EMISSION_ATTEMPT_STATUS.RELEASED].includes(attempt.attemptStatus)) {
      results.push({ attemptId: attempt.attemptId, duplicate: true });
      continue;
    }
    const r = await handleAuthoritativeEmitOutcome({
      attemptId: attempt.attemptId,
      empresaId,
      meiNotaRecordId,
      requestOutcome,
      providerStatus: newStatus,
      sentToProvider: true,
      allocationRequestIds: attempt.allocationRequestIds,
    });
    if (requestOutcome === REQUEST_OUTCOME.SUCCESS) {
      await updateEmissionAttempt(attempt.attemptId, { attemptStatus: EMISSION_ATTEMPT_STATUS.CONSUMED });
    } else if (requestOutcome === REQUEST_OUTCOME.REJECTED) {
      await updateEmissionAttempt(attempt.attemptId, { attemptStatus: EMISSION_ATTEMPT_STATUS.RELEASED });
    }
    results.push(r);
  }

  return { reconciled: true, results };
};

/**
 * Vincula novo idIntegracao ao attempt (recovery numeração) sem nova reserva.
 */
export const bindAuthoritativeAttemptIdIntegracao = async (attemptId, idIntegracao) => {
  if (!attemptId || !idIntegracao) return;
  await updateEmissionAttempt(attemptId, { idIntegracao });
};
