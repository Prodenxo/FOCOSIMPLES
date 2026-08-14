/**
 * Dry-run NF-e authoritative — estruturalmente read-only.
 *
 * REAL: candidate pipeline com reserva + attempt + emit
 * DRY-RUN: preflight read-only + planned allocations → payload normalizado, zero writes.
 *
 * Transforms incluídas (determinísticas/read-only):
 * - buildAuthoritativeNfePayloadFromFiscalResults
 * - applyAuthoritativePlugnotasTributosBridge
 * - applyMeiNfeEmitForcePolicy
 * - validateNfeLikePayload
 * - normalizePlugnotasNfePayload
 * - producao=false default
 *
 * Transforms EXCLUÍDAS (HTTP/DB/cadastro externo):
 * - applyIbptTransparenciaToNfePayload
 * - hydrateMeiNfeEmitenteIeFromEmpresa
 * - ensureMeiNfePlugnotasCadastroBeforeEmit
 * - adapter.emitir / emitirNfe
 */
import { evaluateAuthorityDecisionForDryRunReadOnly } from '../rollout/authority-decision.js';
import { assessReadinessGate, evaluateFiscalV3RolloutReadiness } from '../rollout/rollout-readiness.js';
import { getRolloutPolicyForEmpresa } from '../rollout/rollout-policy.service.js';
import { isFiscalEngineV3Enabled } from '../feature-flag.js';
import {
  AUTHORITY_ENGINE,
  AUTHORITY_DECISION_REASON,
} from '../rollout/rollout-constants.js';
import { runAuthoritativePreflightReadOnly } from './authoritative-preflight.js';
import { buildAuthoritativeNfePayloadFromFiscalResults } from './authoritative-payload-builder.js';
import { applyAuthoritativePlugnotasTributosBridge } from './plugnotas-fiscal-v3-bridge.js';
import {
  resolveFiscalRepositoryMode,
  isFiscalEnginePostgresEnabled,
  isAuthoritativePersistenceBlockedInRuntime,
} from '../config/fiscal-repository-mode.js';
import { validateNfeLikePayload } from '../../lib/nfe-like-payload-validate.js';
import { normalizePlugnotasNfePayload } from '../../services/plugnotas/plugnotas-nfe-payload.js';
import { applyMeiNfeEmitForcePolicy } from '../../services/plugnotas/plugnotas-mei-nfe-emit-force.js';

const ZERO_SIDE_EFFECTS = Object.freeze({
  emissionAttemptsCreated: 0,
  reservationsCreated: 0,
  stockQuantityChanged: false,
  meiNotaCreated: false,
  numberingChanged: false,
  rolloutChanged: false,
  providerCalls: 0,
});

const parseBooleanLike = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não', 'off'].includes(normalized)) return false;
  return fallback;
};

/**
 * Monta itemGroups a partir de planned allocations do preflight read-only.
 * @param {object} preflight
 */
const buildItemGroupsFromPreflight = (preflight) => {
  /** @type {object[]} */
  const itemGroups = [];
  let fiscalOffset = 0;
  const fiscalResults = preflight.fiscalResults ?? [];

  for (const plan of preflight.itemPlans ?? []) {
    const allocations = plan.plannedAllocations ?? [];
    const count = allocations.length || (plan.fiscalContexts?.length ?? 0);
    if (!count) continue;

    itemGroups.push({
      commercialItemIndex: plan.itemIndex ?? 0,
      allocations,
      fiscalResults: fiscalResults.slice(fiscalOffset, fiscalOffset + count),
    });
    fiscalOffset += count;
  }

  return itemGroups;
};

/**
 * Garante config.producao=false no payload comercial (homologação).
 * @param {object} payload
 */
const ensureHomologationConfig = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const config = payload.config && typeof payload.config === 'object'
    ? { ...payload.config }
    : {};
  if (config.producao === undefined) {
    config.producao = false;
  }
  return { ...payload, config };
};

/**
 * Avalia readiness shadow sem persistir — informa NOT_READY se policy exige samples.
 * @param {object} policy
 * @param {string} empresaId
 */
const assessDryRunShadowReadiness = async (policy, empresaId) => {
  const readiness = await evaluateFiscalV3RolloutReadiness(empresaId);
  const gate = assessReadinessGate(readiness, policy);
  return {
    readiness,
    gate,
    shadowSamplesRequired: Number(policy.minimumShadowSamples ?? 0) > 0,
  };
};

/**
 * Separação explícita: fiscal/provider-shape pronto vs emissão real externa.
 * @param {object} params
 */
const buildDryRunReadinessSemantics = ({
  fiscalResolutionReady = false,
  providerBridgeReady = false,
  validationReady = false,
  persistenceReady = false,
}) => {
  const fiscalReady = fiscalResolutionReady;
  const providerShapeReady = fiscalReady && providerBridgeReady && validationReady;
  return {
    fiscalReady,
    providerShapeReady,
    validationReady,
    runtimePersistenceReady: persistenceReady,
    externalProviderReadinessEvaluated: false,
    ieHydration: 'NOT_EVALUATED',
    ibptTransparencia: 'NOT_EVALUATED',
    readyForRealEmission: false,
  };
};

const buildDryRunPersistenceBlock = (persistenceMode, persistenceReady) => ({
  mode: persistenceMode,
  ready: persistenceReady,
  readyForRealEmission: false,
});

/**
 * Dry-run NF-e authoritative read-only — impossível confundir com emissão real.
 *
 * @param {object} params
 * @param {string} params.empresaId
 * @param {string} [params.userId]
 * @param {object} params.commercialPayload
 * @param {string} [params.documentType='NFE']
 * @param {string} [params.businessType]
 * @param {object} [params.metadata]
 * @param {object} [params.rolloutPolicy] policy pré-carregada (read-only)
 * @param {object} [params.inMemoryLotsByProduct]
 * @param {Function} [params.lotFetcher]
 * @returns {Promise<object>}
 */
export const runAuthoritativeNfeDryRunReadOnly = async (params) => {
  const empresaId = String(params.empresaId ?? params.userId ?? '').trim();
  const commercialPayload = ensureHomologationConfig(params.commercialPayload ?? params.legacyPayload ?? {});
  const documentType = String(params.documentType ?? 'NFE').trim().toUpperCase();
  const runtimeEmissionEnabled = isFiscalEngineV3Enabled();
  const persistenceMode = resolveFiscalRepositoryMode();
  const persistenceReady = isFiscalEnginePostgresEnabled()
    && !isAuthoritativePersistenceBlockedInRuntime();

  /** @type {string[]} */
  const blockReasons = [];

  if (!empresaId) {
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: { eligible: false, route: null, reasons: ['MISSING_EMPRESA_ID'] },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady),
      preflight: { ok: false, plannedAllocations: [] },
      fiscal: { ready: false, results: [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons: ['MISSING_EMPRESA_ID'],
    };
  }

  const loadedPolicy = params.rolloutPolicy ?? await getRolloutPolicyForEmpresa(empresaId);

  const authorityDecision = await evaluateAuthorityDecisionForDryRunReadOnly({
    empresaId,
    userId: params.userId ?? empresaId,
    documentType,
    idIntegracao: params.idIntegracao ?? commercialPayload.idIntegracao ?? null,
    meiNotaRecordId: params.meiNotaRecordId ?? null,
    emissionAttemptId: params.emissionAttemptId ?? null,
    correlationId: params.correlationId ?? null,
    rolloutPolicy: loadedPolicy,
    readiness: params.readiness,
  });

  const shadowAssessment = await assessDryRunShadowReadiness(
    loadedPolicy,
    empresaId,
  );

  if (shadowAssessment.shadowSamplesRequired && !shadowAssessment.gate.ready) {
    blockReasons.push(...shadowAssessment.gate.reasons);
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: {
        eligible: authorityDecision.engine === AUTHORITY_ENGINE.V3,
        route: authorityDecision.engine,
        reasons: [...authorityDecision.reasons, ...shadowAssessment.gate.reasons],
      },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady && runtimeEmissionEnabled),
      readiness: { ready: false, reasons: shadowAssessment.gate.reasons },
      preflight: { ok: false, plannedAllocations: [] },
      fiscal: { ready: false, results: [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: authorityDecision.issues ?? [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
    };
  }

  if (authorityDecision.engine === AUTHORITY_ENGINE.BLOCKED) {
    blockReasons.push(...authorityDecision.reasons);
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: {
        eligible: false,
        route: AUTHORITY_ENGINE.BLOCKED,
        reasons: authorityDecision.reasons,
      },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady),
      preflight: { ok: false, plannedAllocations: [] },
      fiscal: { ready: false, results: [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: authorityDecision.issues ?? [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
    };
  }

  if (authorityDecision.engine !== AUTHORITY_ENGINE.V3) {
    blockReasons.push(...authorityDecision.reasons);
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: {
        eligible: false,
        route: authorityDecision.engine,
        reasons: authorityDecision.reasons,
      },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady && runtimeEmissionEnabled),
      preflight: { ok: false, plannedAllocations: [] },
      fiscal: { ready: false, results: [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: authorityDecision.issues ?? [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
      authoritativeNotEligible: true,
    };
  }

  const preflight = await runAuthoritativePreflightReadOnly({
    empresaId,
    userId: params.userId ?? empresaId,
    documentType,
    businessType: params.businessType,
    legacyPayload: commercialPayload,
    metadata: params.metadata ?? {},
    inMemoryLotsByProduct: params.inMemoryLotsByProduct,
    lotFetcher: params.lotFetcher,
    correlationId: params.correlationId,
    emissionAttemptId: params.emissionAttemptId,
  });

  const plannedAllocations = (preflight.itemPlans ?? [])
    .flatMap((plan) => plan.plannedAllocations ?? []);

  if (!preflight.ok) {
    blockReasons.push(AUTHORITY_DECISION_REASON.PREFLIGHT_FAILED);
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: {
        eligible: true,
        route: AUTHORITY_ENGINE.V3,
        reasons: authorityDecision.reasons,
      },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady && runtimeEmissionEnabled),
      preflight: { ok: false, plannedAllocations, issues: preflight.issues ?? [] },
      fiscal: { ready: false, results: preflight.fiscalResults ?? [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: preflight.issues ?? [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
    };
  }

  const itemGroups = buildItemGroupsFromPreflight(preflight);
  if (!itemGroups.length) {
    blockReasons.push('MISSING_PLANNED_ALLOCATIONS');
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: { eligible: true, route: AUTHORITY_ENGINE.V3, reasons: authorityDecision.reasons },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady && runtimeEmissionEnabled),
      preflight: { ok: false, plannedAllocations },
      fiscal: { ready: false, results: preflight.fiscalResults ?? [] },
      providerBridge: { ready: false },
      validation: { ready: false, issues: [{ code: 'MISSING_PLANNED_ALLOCATIONS' }] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
    };
  }

  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: commercialPayload,
    itemGroups,
  });

  const bridged = applyAuthoritativePlugnotasTributosBridge({
    payload: built.payload,
    itemGroups,
  });

  if (!bridged.ok) {
    blockReasons.push(AUTHORITY_DECISION_REASON.AUTHORITATIVE_PROVIDER_BRIDGE_NOT_EXECUTABLE);
    return {
      ok: false,
      dryRun: true,
      dryRunFiscalReady: false,
      runtimeEmissionEnabled,
      routing: { eligible: true, route: AUTHORITY_ENGINE.V3, reasons: authorityDecision.reasons },
      persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady && runtimeEmissionEnabled),
      preflight: { ok: true, plannedAllocations },
      fiscal: { ready: true, results: preflight.fiscalResults ?? [] },
      providerBridge: { ready: false, issues: bridged.issues ?? [] },
      validation: { ready: false, issues: bridged.issues ?? [] },
      normalizedPayload: null,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      blockReasons,
    };
  }

  let payloadForValidation = applyMeiNfeEmitForcePolicy(bridged.payload);
  if (payloadForValidation?.config?.producao === undefined) {
    payloadForValidation = {
      ...payloadForValidation,
      config: { ...(payloadForValidation.config ?? {}), producao: false },
    };
  } else {
    payloadForValidation = {
      ...payloadForValidation,
      config: {
        ...(payloadForValidation.config ?? {}),
        producao: parseBooleanLike(payloadForValidation.config.producao, false),
      },
    };
  }

  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const validationIssues = [];
  let validationReady = false;
  try {
    validateNfeLikePayload(payloadForValidation, { label: 'NF-e' });
    validationReady = true;
  } catch (error) {
    validationIssues.push({
      code: 'VALIDATION_FAILED',
      message: error instanceof Error ? error.message : String(error),
      blocksEmission: true,
    });
  }

  let normalizedPayload = null;
  if (validationReady) {
    normalizedPayload = normalizePlugnotasNfePayload(payloadForValidation);
  }

  const dryRunFiscalReady = validationReady && Boolean(normalizedPayload);

  const readinessSemantics = buildDryRunReadinessSemantics({
    fiscalResolutionReady: preflight.ok && bridged.ok,
    providerBridgeReady: bridged.ok,
    validationReady,
    persistenceReady,
  });

  return {
    ok: dryRunFiscalReady,
    dryRun: true,
    dryRunFiscalReady,
    runtimeEmissionEnabled,
    routing: {
      eligible: true,
      route: AUTHORITY_ENGINE.V3,
      reasons: authorityDecision.reasons,
    },
    persistence: buildDryRunPersistenceBlock(persistenceMode, persistenceReady),
    readiness: shadowAssessment.shadowSamplesRequired
      ? { ready: shadowAssessment.gate.ready, reasons: shadowAssessment.gate.reasons }
      : { ready: true, reasons: [] },
    readinessSemantics,
    preflight: {
      ok: preflight.ok,
      plannedAllocations,
      itemPlans: preflight.itemPlans,
    },
    fiscal: {
      ready: true,
      results: preflight.fiscalResults ?? [],
    },
    providerBridge: {
      ready: bridged.ok,
    },
    validation: {
      ready: validationReady,
      issues: validationIssues,
    },
    normalizedPayload,
    technicalTransforms: {
      included: [
        'buildAuthoritativeNfePayloadFromFiscalResults',
        'applyAuthoritativePlugnotasTributosBridge',
        'applyMeiNfeEmitForcePolicy',
        'validateNfeLikePayload',
        'normalizePlugnotasNfePayload',
        'producao=false',
      ],
      excluded: [
        'applyIbptTransparenciaToNfePayload',
        'hydrateMeiNfeEmitenteIeFromEmpresa',
        'ensureMeiNfePlugnotasCadastroBeforeEmit',
        'adapter.emitir',
        'emitirNfe',
      ],
    },
    sideEffects: { ...ZERO_SIDE_EFFECTS },
    blockReasons: dryRunFiscalReady ? [] : blockReasons,
    candidateAudit: built.audit,
  };
};
