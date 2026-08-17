/**
 * Serviço de política de rollout por tenant — fail-safe LEGACY.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { getInMemoryRolloutPolicy } from './rollout-policy-memory.repository.js';
import * as pgRepo from './rollout-policy.repository.js';
import { DEFAULT_ROLLOUT_POLICY, ROLLOUT_MODE } from './rollout-constants.js';
import {
  FISCAL_REPOSITORY_MODE,
  isFiscalEnginePostgresEnabled,
  __setFiscalRepositoryModeForTests,
  __resetFiscalRepositoryModeForTests,
} from '../config/fiscal-repository-mode.js';

/** @internal */
export const __setRolloutPolicyPostgresEnabledForTests = (enabled) => {
  __setFiscalRepositoryModeForTests(
    enabled ? FISCAL_REPOSITORY_MODE.POSTGRES : FISCAL_REPOSITORY_MODE.MEMORY,
  );
};

/** @internal */
export const __resetRolloutPolicyServiceForTests = () => {
  __resetFiscalRepositoryModeForTests();
};

/**
 * Ausência de configuração → LEGACY (nunca authoritative).
 * Modo inválido → LEGACY + issue auditável.
 * @param {string} empresaId
 * @param {string | null} [establishmentId]
 */
export const getRolloutPolicyForEmpresa = async (empresaId, establishmentId = null) => {
  if (!empresaId) {
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      issues: [createFiscalIssue('REQUIRED_FIELD_MISSING', 'empresaId obrigatório para rollout policy')],
    };
  }

  let policy;
  try {
    policy = isFiscalEnginePostgresEnabled()
      ? await pgRepo.fetchRolloutPolicyFromPg(empresaId, establishmentId)
      : getInMemoryRolloutPolicy(empresaId, establishmentId);
  } catch (error) {
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      issues: [createFiscalIssue(
        'SCHEMA_INVALID',
        `Falha ao carregar rollout policy — fail-safe LEGACY: ${error instanceof Error ? error.message : error}`,
        { severity: 'INFO', blocksEmission: false },
      )],
    };
  }

  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];

  if (policy.invalidMode) {
    issues.push(createFiscalIssue(
      'SCHEMA_INVALID',
      `Modo de rollout inválido "${policy.invalidMode}" — fail-safe LEGACY`,
      { severity: 'WARNING', blocksEmission: false, meta: { invalidMode: policy.invalidMode } },
    ));
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      configured: true,
      issues,
    };
  }

  if (!policy.enabled && policy.mode !== ROLLOUT_MODE.LEGACY) {
    return {
      ...policy,
      mode: ROLLOUT_MODE.LEGACY,
      issues: [createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Rollout tenant desabilitado (enabled=false) — fail-safe LEGACY',
        { severity: 'INFO', blocksEmission: false },
      )],
    };
  }

  return { ...policy, issues };
};
