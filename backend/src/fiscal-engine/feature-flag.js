/**
 * Feature flag do Fiscal Engine v3.
 * OFF por padrão — emissão legada permanece inalterada.
 */

/** @param {string | undefined | null} [raw] */
const parseTruthy = (raw) => {
  const normalized = String(raw ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'sim', 'on'].includes(normalized);
};

/** Valor efetivo da flag (lê process.env diretamente para testes). */
export const isFiscalEngineV3Enabled = () => parseTruthy(process.env.FISCAL_ENGINE_V3);

/** @internal Apenas testes — restaura env após o teste. */
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
