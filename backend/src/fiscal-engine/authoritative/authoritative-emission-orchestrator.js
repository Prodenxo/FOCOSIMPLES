/**
 * Orquestrador authoritative — Fase 8A infraestrutura.
 *
 * Sequência:
 * rollout gates → preflight read-only → reserva real → revalidação → authority → emit
 *
 * Com defaults atuais, sempre retorna roteamento LEGACY fail-safe.
 */
import { randomUUID } from 'node:crypto';
import {
  evaluateAuthorityDecision,
  markAuthorityNotEligibleAfterPreflight,
  assumeV3Authority,
} from '../rollout/authority-decision.js';
import {
  runAuthoritativePreflightReadOnly,
  runAuthoritativePreflightPostReservation,
} from './authoritative-preflight.js';
import { buildAuthoritativeNfePayloadFromFiscalResults } from './authoritative-payload-builder.js';
import { allocateFiscalStockForSaleItem, releaseFiscalStockAllocation } from '../allocation/stock-allocation.service.js';
import {
  persistAuthorityRoutingAttempt,
  updateEmissionAttempt,
  hashPayloadForAudit,
} from './emission-attempt.service.js';
import {
  classifyEmitRequestOutcome,
  resolveReservationTransition,
  applyReservationLifecycle,
} from './reservation-lifecycle.js';
import {
  AUTHORITY_ENGINE,
  EMISSION_ATTEMPT_STATUS,
  REQUEST_OUTCOME,
} from '../rollout/rollout-constants.js';
import { isFiscalEngineV3Enabled } from '../feature-flag.js';

/**
 * Avalia roteamento completo — não emite; retorna decisão + audit.
 * @param {object} params
 */
export const evaluateAuthoritativeEmissionRouting = async (params) => {
  const authorityDecision = await evaluateAuthorityDecision({
    empresaId: params.empresaId ?? params.userId,
    userId: params.userId,
    documentType: params.documentType,
    idIntegracao: params.idIntegracao,
    meiNotaRecordId: params.meiNotaRecordId,
    emissionAttemptId: params.emissionAttemptId,
    correlationId: params.correlationId,
    rolloutPolicy: params.rolloutPolicy,
    readiness: params.readiness,
  });

  const attempt = await persistAuthorityRoutingAttempt({
    empresaId: params.empresaId ?? params.userId,
    documentType: params.documentType,
    idIntegracao: params.idIntegracao,
    meiNotaRecordId: params.meiNotaRecordId,
    emissionAttemptId: params.emissionAttemptId,
    correlationId: params.correlationId,
    authorityDecision,
    attemptStatus: authorityDecision.engine === AUTHORITY_ENGINE.V3
      ? EMISSION_ATTEMPT_STATUS.AUTHORITATIVE_NOT_ELIGIBLE
      : EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY,
  });

  if (authorityDecision.engine !== AUTHORITY_ENGINE.V3) {
    return {
      route: AUTHORITY_ENGINE.LEGACY,
      authorityDecision,
      attemptId: attempt.attemptId,
      preflight: null,
      candidatePayload: null,
    };
  }

  const legacyBefore = params.legacyPayload;
  const preflight = await runAuthoritativePreflightReadOnly({
    ...params,
    preflightId: `preflight-${attempt.attemptId}`,
  });

  if (!preflight.ok) {
    const notEligible = markAuthorityNotEligibleAfterPreflight(authorityDecision, preflight);
    await updateEmissionAttempt(attempt.attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.PREFLIGHT_FAILED,
      preflightResult: preflight,
      issues: notEligible.issues,
    });
    return {
      route: AUTHORITY_ENGINE.LEGACY,
      authorityDecision: notEligible,
      attemptId: attempt.attemptId,
      preflight,
      candidatePayload: null,
      authoritativeNotEligible: true,
    };
  }

  return {
    route: AUTHORITY_ENGINE.V3,
    authorityDecision,
    attemptId: attempt.attemptId,
    preflight,
    candidatePayload: null,
    v3CandidateAwaitingReservation: true,
    legacyPayloadUnmutated: JSON.stringify(legacyBefore) === JSON.stringify(params.legacyPayload),
  };
};

/**
 * Pipeline completo com reserva real — só invocável quando V3 candidata explícita.
 * Não substitui emitirNota nesta rodada — infraestrutura para testes futuros.
 * @param {object} params
 */
export const prepareAuthoritativeEmissionCandidate = async (params) => {
  const routing = await evaluateAuthoritativeEmissionRouting(params);
  if (routing.route !== AUTHORITY_ENGINE.V3 || !routing.preflight?.ok) {
    return routing;
  }

  /** @type {string[]} */
  const allocationRequestIds = [];
  /** @type {object[]} */
  const reservedGroups = [];

  for (const itemPlan of routing.preflight.itemPlans ?? []) {
    const commercial = itemPlan.commercialItem;
    if (!commercial?.produtoCatalogoId || !commercial?.quantidade) continue;

    const allocationRequestId = params.allocationRequestIds?.[itemPlan.itemIndex]
      ?? `auth-alloc-${params.attemptId ?? randomUUID()}-${itemPlan.itemIndex}`;

    const reserveResult = await allocateFiscalStockForSaleItem({
      empresaId: params.empresaId ?? params.userId,
      produtoCatalogoId: commercial.produtoCatalogoId,
      quantidade: String(commercial.quantidade),
      allocationRequestId,
      commercialSaleId: commercial.commercialSaleId,
      commercialSaleItemId: commercial.commercialSaleItemId,
    });

    if (!reserveResult.ok) {
      for (const reqId of allocationRequestIds) {
        await releaseFiscalStockAllocation(params.empresaId ?? params.userId, reqId);
      }
      const notEligible = markAuthorityNotEligibleAfterPreflight(routing.authorityDecision, {
        preflightId: routing.preflight.preflightId,
        issues: reserveResult.issues,
      });
      await updateEmissionAttempt(routing.attemptId, {
        attemptStatus: EMISSION_ATTEMPT_STATUS.PREFLIGHT_FAILED,
        issues: notEligible.issues,
      });
      return {
        ...routing,
        route: AUTHORITY_ENGINE.LEGACY,
        authorityDecision: notEligible,
        reservationFailed: true,
      };
    }

    allocationRequestIds.push(allocationRequestId);
    reservedGroups.push({
      commercialItem: commercial,
      commercialItemIndex: itemPlan.itemIndex,
      allocations: reserveResult.allocations,
      allocationRequestId,
    });
  }

  const postPreflight = await runAuthoritativePreflightPostReservation({
    empresaId: params.empresaId ?? params.userId,
    businessType: params.businessType,
    legacyPayload: params.legacyPayload,
    emitente: params.legacyPayload?.emitente,
    destinatario: params.legacyPayload?.destinatario,
    metadata: params.metadata,
    reservedAllocations: reservedGroups,
    requestedQuantities: reservedGroups.map((g) => ({
      commercialSaleItemId: g.commercialItem.commercialSaleItemId,
      quantidade: g.commercialItem.quantidade,
    })),
  });

  if (!postPreflight.ok) {
    for (const reqId of allocationRequestIds) {
      await releaseFiscalStockAllocation(params.empresaId ?? params.userId, reqId);
    }
    const notEligible = markAuthorityNotEligibleAfterPreflight(routing.authorityDecision, postPreflight);
    await updateEmissionAttempt(routing.attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.PREFLIGHT_FAILED,
      preflightResult: postPreflight,
      issues: notEligible.issues,
    });
    return {
      ...routing,
      route: AUTHORITY_ENGINE.LEGACY,
      authorityDecision: notEligible,
      postReservationFailed: true,
    };
  }

  const itemGroups = [];
  let fiscalOffset = 0;
  for (const group of reservedGroups) {
    const count = group.allocations.length;
    itemGroups.push({
      commercialItemIndex: group.commercialItemIndex,
      allocations: group.allocations,
      fiscalResults: postPreflight.fiscalResults.slice(fiscalOffset, fiscalOffset + count),
    });
    fiscalOffset += count;
  }

  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: params.legacyPayload,
    itemGroups,
  });

  const assumed = assumeV3Authority(routing.authorityDecision, {
    preflightId: postPreflight.preflightId,
  });

  await updateEmissionAttempt(routing.attemptId, {
    attemptStatus: EMISSION_ATTEMPT_STATUS.AUTHORITY_ASSUMED_V3,
    allocationRequestIds,
    candidatePayloadHash: hashPayloadForAudit(built.payload),
    preflightResult: postPreflight,
  });

  return {
    ...routing,
    authorityDecision: assumed,
    allocationRequestIds,
    candidatePayload: built.payload,
    candidateAudit: built.audit,
    postPreflight,
    authorityAssumed: true,
  };
};

/**
 * Pós-emissão — lifecycle reserva (network error não libera).
 * @param {object} params
 */
export const reconcileAuthoritativeReservationAfterEmit = async (params) => {
  const outcome = params.requestOutcome ?? classifyEmitRequestOutcome(params.error);
  const transition = resolveReservationTransition({
    requestOutcome: outcome,
    providerStatus: params.providerStatus,
  });

  if (outcome === REQUEST_OUTCOME.NETWORK_ERROR || outcome === REQUEST_OUTCOME.UNKNOWN) {
    await updateEmissionAttempt(params.attemptId, {
      attemptStatus: EMISSION_ATTEMPT_STATUS.REQUEST_OUTCOME_UNKNOWN,
    });
  }

  const results = [];
  for (const reqId of params.allocationRequestIds ?? []) {
    const result = await applyReservationLifecycle(
      params.empresaId,
      reqId,
      transition,
    );
    results.push({ allocationRequestId: reqId, result, transition });
  }

  return { outcome, transition, results };
};

/**
 * Guard — emissão authoritative só quando master switch ON e decisão V3 assumida.
 */
export const isAuthoritativeEmissionEnabled = () => isFiscalEngineV3Enabled();
