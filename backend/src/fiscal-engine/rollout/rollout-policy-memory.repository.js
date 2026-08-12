/**
 * Repositório in-memory de rollout por tenant — testes e fail-open.
 */
import {
  DEFAULT_ROLLOUT_POLICY,
  ROLLOUT_MODE,
  VALID_ROLLOUT_MODES,
} from './rollout-constants.js';

/** @type {Map<string, object>} */
const policiesByEmpresa = new Map();

/**
 * @param {string} mode
 */
export const normalizeRolloutMode = (mode) => {
  const normalized = String(mode ?? ROLLOUT_MODE.LEGACY).trim().toUpperCase();
  return VALID_ROLLOUT_MODES.includes(normalized) ? normalized : null;
};

/**
 * @param {object} row
 */
export const mapRolloutPolicyRow = (row, empresaId) => {
  if (!row) {
    return { ...DEFAULT_ROLLOUT_POLICY, empresaId, configured: false };
  }
  const mode = normalizeRolloutMode(row.mode);
  if (!mode) {
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      configured: true,
      invalidMode: String(row.mode ?? ''),
    };
  }
  return {
    empresaId,
    mode,
    canaryPercentage: Number(row.canary_percentage ?? row.canaryPercentage ?? 0),
    enabled: row.enabled === true,
    engineVersion: String(row.engine_version ?? row.engineVersion ?? DEFAULT_ROLLOUT_POLICY.engineVersion),
    minimumShadowSamples: Number(row.minimum_shadow_samples ?? row.minimumShadowSamples ?? 0),
    readinessRequired: row.readiness_required !== false && row.readinessRequired !== false,
    reason: row.reason ?? null,
    configured: true,
  };
};

export const getInMemoryRolloutPolicy = (empresaId) => {
  const row = policiesByEmpresa.get(String(empresaId));
  return mapRolloutPolicyRow(row, empresaId);
};

export const upsertInMemoryRolloutPolicy = (empresaId, policy) => {
  policiesByEmpresa.set(String(empresaId), {
    mode: policy.mode ?? ROLLOUT_MODE.LEGACY,
    canary_percentage: policy.canaryPercentage ?? 0,
    enabled: policy.enabled === true,
    engine_version: policy.engineVersion ?? DEFAULT_ROLLOUT_POLICY.engineVersion,
    minimum_shadow_samples: policy.minimumShadowSamples ?? 0,
    readiness_required: policy.readinessRequired !== false,
    reason: policy.reason ?? null,
  });
};

/** @internal */
export const __resetRolloutPolicyMemoryForTests = () => {
  policiesByEmpresa.clear();
};
