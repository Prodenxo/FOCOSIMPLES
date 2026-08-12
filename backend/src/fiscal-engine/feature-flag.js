/**
 * Feature flags do Fiscal Engine v3 — authoritative vs shadow (Fase 7A).
 * Defaults: FISCAL_ENGINE_V3=false, FISCAL_ENGINE_V3_SHADOW=false
 */
/** @param {string | undefined | null} [raw] */
const parseTruthy = (raw) => {
  const normalized = String(raw ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'sim', 'on'].includes(normalized);
};

/** Motor v3 authoritative — OFF por padrão; não altera emissão legada nesta fase. */
export const isFiscalEngineV3Enabled = () => parseTruthy(process.env.FISCAL_ENGINE_V3);

/** Shadow mode — observação/comparação apenas; nunca substitui payload legado. */
export const isFiscalEngineV3ShadowEnabled = () => parseTruthy(process.env.FISCAL_ENGINE_V3_SHADOW);

/**
 * Shadow ativo não implica v3 authoritative.
 *
 * Guard temporário Fase 7A: bloqueia V3=true + SHADOW=true simultâneos para evitar
 * rollout acidental antes da Fase 8. Isso NÃO é dependência arquitetural permanente.
 * Regra fundamental: SHADOW jamais altera emissão — independente de FISCAL_ENGINE_V3.
 */
export const assertShadowDoesNotAuthorizeEmission = () => {
  if (isFiscalEngineV3ShadowEnabled() && isFiscalEngineV3Enabled()) {
    throw new Error(
      'FISCAL_ENGINE_V3_SHADOW não pode estar ativo junto com FISCAL_ENGINE_V3=true nesta fase (guard temporário 7A).',
    );
  }
};

/** @internal */
export const __withFiscalEngineV3FlagForTests = async (enabled, fn) => {
  const previous = process.env.FISCAL_ENGINE_V3;
  try {
    if (enabled) {
      process.env.FISCAL_ENGINE_V3 = 'true';
    } else {
      delete process.env.FISCAL_ENGINE_V3;
    }
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.FISCAL_ENGINE_V3;
    } else {
      process.env.FISCAL_ENGINE_V3 = previous;
    }
  }
};

/** @internal */
export const __withFiscalEngineV3ShadowFlagForTests = async (enabled, fn) => {
  const previous = process.env.FISCAL_ENGINE_V3_SHADOW;
  try {
    if (enabled) {
      process.env.FISCAL_ENGINE_V3_SHADOW = 'true';
    } else {
      delete process.env.FISCAL_ENGINE_V3_SHADOW;
    }
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.FISCAL_ENGINE_V3_SHADOW;
    } else {
      process.env.FISCAL_ENGINE_V3_SHADOW = previous;
    }
  }
};

/** @internal */
export const __withFiscalEngineFlagsForTests = async ({ v3 = false, shadow = false }, fn) => (
  __withFiscalEngineV3FlagForTests(v3, () => __withFiscalEngineV3ShadowFlagForTests(shadow, fn))
);
