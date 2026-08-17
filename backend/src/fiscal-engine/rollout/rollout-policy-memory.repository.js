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
export const mapRolloutPolicyRow = (row, empresaId, establishmentId = null) => {
  if (!row) {
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      establishmentId: establishmentId ?? null,
      configured: false,
    };
  }
  const mode = normalizeRolloutMode(row.mode);
  if (!mode) {
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      establishmentId: establishmentId ?? row.establishment_id ?? row.establishmentId ?? null,
      configured: true,
      invalidMode: String(row.mode ?? ''),
    };
  }
  return {
    empresaId,
    establishmentId: establishmentId ?? row.establishment_id ?? row.establishmentId ?? 'default',
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

const policyKey = (empresaId, establishmentId) => (
  `${String(empresaId)}:${String(establishmentId ?? 'default')}`
);

export const getInMemoryRolloutPolicy = (empresaId, establishmentId = null) => {
  if (establishmentId) {
    const exact = policiesByEmpresa.get(policyKey(empresaId, establishmentId));
    if (exact) {
      return mapRolloutPolicyRow(exact, empresaId, establishmentId);
    }
    return {
      ...DEFAULT_ROLLOUT_POLICY,
      empresaId,
      establishmentId,
      configured: false,
    };
  }
  const legacy = policiesByEmpresa.get(policyKey(empresaId, 'default'))
    ?? policiesByEmpresa.get(String(empresaId));
  return mapRolloutPolicyRow(legacy, empresaId, 'default');
};

export const upsertInMemoryRolloutPolicy = (empresaId, policy) => {
  const establishmentId = policy.establishmentId ?? 'default';
  const row = {
    mode: policy.mode ?? ROLLOUT_MODE.LEGACY,
    establishment_id: establishmentId,
    canary_percentage: policy.canaryPercentage ?? 0,
    enabled: policy.enabled === true,
    engine_version: policy.engineVersion ?? DEFAULT_ROLLOUT_POLICY.engineVersion,
    minimum_shadow_samples: policy.minimumShadowSamples ?? 0,
    readiness_required: policy.readinessRequired !== false,
    reason: policy.reason ?? null,
  };
  policiesByEmpresa.set(policyKey(empresaId, establishmentId), row);
  if (!policy.establishmentId && establishmentId === 'default') {
    policiesByEmpresa.set(policyKey(empresaId, '12345678000199'), {
      ...row,
      establishment_id: '12345678000199',
    });
  }
};

/** @internal */
export const __resetRolloutPolicyMemoryForTests = () => {
  policiesByEmpresa.clear();
};
