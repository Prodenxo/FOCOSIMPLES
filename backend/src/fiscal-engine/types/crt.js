/**
 * CRT — Código de Regime Tributário (canônico NF-e).
 * 1 = Simples Nacional
 * 2 = Simples Nacional — excesso sublimite
 * 3 = Regime Normal
 * 4 = Simples Nacional — MEI
 */

/** @typedef {1 | 2 | 3 | 4} Crt */

export const CRT = Object.freeze({
  SIMPLES_NACIONAL: 1,
  SIMPLES_EXCESSO: 2,
  REGIME_NORMAL: 3,
  MEI: 4,
});

/** @type {readonly Crt[]} */
export const ALL_CRT = Object.freeze([1, 2, 3, 4]);

/** CSOSN só é legalmente aplicável nestes CRTs (v3.1). */
/** @type {readonly Crt[]} */
export const CSOSN_COMPATIBLE_CRT = Object.freeze([1, 4]);

/** MEI possui ruleset próprio — não herda automaticamente regras CRT 1. */
export const CRT_MEI_PROFILE = Object.freeze({
  crt: CRT.MEI,
  rulesetId: 'crt-4-mei',
  sharesBaseRulesWithCrt1: false,
});

export const CRT_SIMPLES_PROFILE = Object.freeze({
  crt: CRT.SIMPLES_NACIONAL,
  rulesetId: 'crt-1-simples',
});

export const CRT_EXCESSO_PROFILE = Object.freeze({
  crt: CRT.SIMPLES_EXCESSO,
  rulesetId: 'crt-2-excesso',
  /** Fluxo separado — não reutiliza regras CRT 1 implicitamente. */
  sharesBaseRulesWithCrt1: false,
});

/**
 * @param {unknown} value
 * @returns {Crt | null}
 */
export const normalizeCrt = (value) => {
  const n = Number(String(value ?? '').trim());
  if (n === 1 || n === 2 || n === 3 || n === 4) return /** @type {Crt} */ (n);
  return null;
};

/**
 * Verifica se uma regra com applicableCrt explícito cobre o CRT informado.
 * Regra SEM applicableCrt não faz match automático — exige declaração explícita (v3.1).
 * @param {Crt} crt
 * @param {Crt[] | null | undefined} applicableCrt
 */
export const crtMatchesRule = (crt, applicableCrt) => {
  if (!Array.isArray(applicableCrt) || applicableCrt.length === 0) return false;
  return applicableCrt.includes(crt);
};

/**
 * @param {Crt} crt
 */
export const getCrtProfile = (crt) => {
  if (crt === CRT.MEI) return CRT_MEI_PROFILE;
  if (crt === CRT.SIMPLES_NACIONAL) return CRT_SIMPLES_PROFILE;
  if (crt === CRT.SIMPLES_EXCESSO) return CRT_EXCESSO_PROFILE;
  return { crt, rulesetId: `crt-${crt}` };
};

/**
 * @param {Crt} crt
 */
export const crtSupportsCsosn = (crt) => CSOSN_COMPATIBLE_CRT.includes(crt);
