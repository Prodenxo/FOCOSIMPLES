/**
 * Decisão multi-gate de autoridade fiscal — Fase 8A.
 *
 * Nunca um único if (FISCAL_ENGINE_V3).
 * Master switch + tenant policy + document + canary + readiness + production rules.
 */
import { isFiscalEngineV3Enabled } from '../feature-flag.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { getRolloutPolicyForEmpresa } from './rollout-policy.service.js';
import {
  assessReadinessGate,
  evaluateFiscalV3RolloutReadiness,
} from './rollout-readiness.js';
import { hasAuthoritativeAccountantConfigReadinessAsync } from './rollout-accountant-config-gate.js';
import { isCanarySelected, resolveEmissionStableId } from './rollout-canary.js';
import {
  AUTHORITY_ENGINE,
  AUTHORITY_DECISION_REASON,
  AUTHORITATIVE_ELIGIBLE_DOCUMENT_TYPES,
  DEFAULT_ENGINE_VERSION,
  ROLLOUT_MODE,
} from './rollout-constants.js';
import { isAuthoritativePersistenceBlockedInRuntime } from '../config/fiscal-repository-mode.js';

/**
 * @typedef {object} AuthorityDecision
 * @property {'LEGACY' | 'V3' | 'BLOCKED'} engine
 * @property {string[]} reasons
 * @property {string | null} rolloutMode
 * @property {boolean | null} canarySelected
 * @property {object | null} readiness
 * @property {string | null} preflightId
 * @property {string} engineVersion
 * @property {boolean} v3Candidate
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 */

/**
 * @param {object} params
 * @returns {Promise<AuthorityDecision>}
 */
export const evaluateAuthorityDecision = async (params) => {
  const empresaId = params.empresaId ?? params.userId ?? null;
  const documentType = String(params.documentType ?? 'NFE').trim().toUpperCase();
  const emissionStableId = resolveEmissionStableId({
    meiNotaRecordId: params.meiNotaRecordId,
    emissionAttemptId: params.emissionAttemptId,
    idIntegracao: params.idIntegracao,
    correlationId: params.correlationId,
  });

  /** @type {string[]} */
  const reasons = [];
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];

  if (!isFiscalEngineV3Enabled()) {
    return buildDecision({
      engine: AUTHORITY_ENGINE.LEGACY,
      reasons: [AUTHORITY_DECISION_REASON.MASTER_SWITCH_OFF],
      rolloutMode: null,
      canarySelected: null,
      readiness: null,
      issues,
    });
  }

  const policy = params.rolloutPolicy ?? await getRolloutPolicyForEmpresa(empresaId);
  if (policy.issues?.length) issues.push(...policy.issues);

  if (!policy.configured) {
    reasons.push(AUTHORITY_DECISION_REASON.TENANT_LEGACY_DEFAULT);
    return buildDecision({
      engine: AUTHORITY_ENGINE.LEGACY,
      reasons,
      rolloutMode: ROLLOUT_MODE.LEGACY,
      canarySelected: null,
      readiness: null,
      issues,
    });
  }

  const rolloutMode = policy.mode;

  if (rolloutMode === ROLLOUT_MODE.LEGACY) {
    reasons.push(AUTHORITY_DECISION_REASON.TENANT_MODE_LEGACY);
    return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected: null, readiness: null, issues });
  }

  if (rolloutMode === ROLLOUT_MODE.SHADOW) {
    reasons.push(AUTHORITY_DECISION_REASON.TENANT_MODE_SHADOW);
    return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected: null, readiness: null, issues });
  }

  if (rolloutMode === ROLLOUT_MODE.PAUSED) {
    reasons.push(AUTHORITY_DECISION_REASON.TENANT_MODE_PAUSED);
    return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected: null, readiness: null, issues });
  }

  if (!AUTHORITATIVE_ELIGIBLE_DOCUMENT_TYPES.includes(documentType)) {
    reasons.push(AUTHORITY_DECISION_REASON.DOCUMENT_NOT_ELIGIBLE);
    return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected: null, readiness: null, issues });
  }

  let canarySelected = null;
  if (rolloutMode === ROLLOUT_MODE.CANARY) {
    canarySelected = isCanarySelected(empresaId, emissionStableId, policy.canaryPercentage);
    if (!canarySelected) {
      reasons.push(AUTHORITY_DECISION_REASON.CANARY_NOT_SELECTED);
      return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected, readiness: null, issues });
    }
  }

  if (isAuthoritativePersistenceBlockedInRuntime()) {
    reasons.push(AUTHORITY_DECISION_REASON.AUTHORITATIVE_PERSISTENCE_UNAVAILABLE);
    issues.push(createFiscalIssue(
      'AUTHORITATIVE_PERSISTENCE_UNAVAILABLE',
      'Persistência authoritative exige Postgres — runtime bootstrapped em memory fail-closed',
      { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
    ));
    return buildDecision({
      engine: AUTHORITY_ENGINE.BLOCKED,
      reasons: [...reasons, AUTHORITY_DECISION_REASON.AUTHORITATIVE_FISCAL_BLOCKED],
      rolloutMode,
      canarySelected,
      readiness: null,
      v3Candidate: true,
      authoritativeFiscalBlocked: true,
      issues,
    });
  }

  if (!(await hasAuthoritativeAccountantConfigReadinessAsync(empresaId))) {
    reasons.push(AUTHORITY_DECISION_REASON.NOT_READY_NO_ACCOUNTANT_CONFIG);
    issues.push(createFiscalIssue(
      'ACCOUNTANT_CONFIGURATION_INCOMPLETE',
      'Configuração fiscal do contador indisponível ou sem regra APPROVED executável — authoritative fail-closed',
      { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
    ));
    return buildDecision({
      engine: AUTHORITY_ENGINE.BLOCKED,
      reasons: [...reasons, AUTHORITY_DECISION_REASON.AUTHORITATIVE_FISCAL_BLOCKED],
      rolloutMode,
      canarySelected,
      readiness: null,
      v3Candidate: true,
      authoritativeFiscalBlocked: true,
      issues,
    });
  }

  const readiness = params.readiness ?? await evaluateFiscalV3RolloutReadiness(empresaId);
  if (policy.readinessRequired !== false) {
    const gate = assessReadinessGate(readiness, policy);
    if (!gate.ready) {
      reasons.push(AUTHORITY_DECISION_REASON.READINESS_NOT_MET, ...gate.reasons);
      return buildDecision({ engine: AUTHORITY_ENGINE.LEGACY, reasons, rolloutMode, canarySelected, readiness, issues });
    }
  }

  reasons.push(AUTHORITY_DECISION_REASON.V3_CANDIDATE);
  return buildDecision({
    engine: AUTHORITY_ENGINE.V3,
    reasons,
    rolloutMode,
    canarySelected,
    readiness,
    v3Candidate: true,
    issues,
  });
};

/**
 * Fail-closed após seleção authoritative — nunca degradar fiscal para legacy.
 * @param {AuthorityDecision} priorDecision
 * @param {object} failureResult
 * @param {string} [blockReason]
 */
export const markAuthoritativeFiscalBlocked = (
  priorDecision,
  failureResult,
  blockReason = AUTHORITY_DECISION_REASON.AUTHORITATIVE_FISCAL_BLOCKED,
) => {
  /** @type {string[]} */
  const extraReasons = [blockReason, AUTHORITY_DECISION_REASON.PREFLIGHT_FAILED];
  if (failureResult?.reasonCode) {
    extraReasons.unshift(failureResult.reasonCode);
  }

  return {
    ...priorDecision,
    engine: AUTHORITY_ENGINE.BLOCKED,
    reasons: [
      ...priorDecision.reasons.filter((r) => r !== AUTHORITY_DECISION_REASON.V3_CANDIDATE),
      ...extraReasons,
    ],
    preflightId: failureResult?.preflightId ?? priorDecision.preflightId ?? null,
    v3Candidate: true,
    authoritativeFiscalBlocked: true,
    issues: [...(priorDecision.issues ?? []), ...(failureResult?.issues ?? [])],
  };
};

/** @deprecated Use markAuthoritativeFiscalBlocked — mantido para compatibilidade de import. */
export const markAuthorityNotEligibleAfterPreflight = markAuthoritativeFiscalBlocked;

/**
 * Assunção explícita de autoridade V3 — ponto sem retorno silencioso ao legado.
 * @param {AuthorityDecision} decision
 * @param {object} extras
 */
export const assumeV3Authority = (decision, extras = {}) => ({
  ...decision,
  engine: AUTHORITY_ENGINE.V3,
  reasons: [...decision.reasons, AUTHORITY_DECISION_REASON.V3_SELECTED],
  preflightId: extras.preflightId ?? decision.preflightId,
  authorityAssumedAt: new Date().toISOString(),
  v3Candidate: true,
});

const buildDecision = ({
  engine,
  reasons,
  rolloutMode,
  canarySelected,
  readiness,
  preflightId = null,
  v3Candidate = false,
  authoritativeFiscalBlocked = false,
  issues = [],
}) => ({
  engine,
  reasons: [...reasons],
  rolloutMode,
  canarySelected,
  readiness,
  preflightId,
  engineVersion: DEFAULT_ENGINE_VERSION,
  v3Candidate,
  authoritativeFiscalBlocked,
  issues,
});
