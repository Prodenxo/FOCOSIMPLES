/** Limites de referência MEI / Simples Nacional por ano civil. */

export const MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR = Object.freeze({
  2024: 81_000,
  2025: 81_000,
  2026: 81_000,
});

export const SIMPLES_LIMITE_REFERENCIA_REAIS_BY_YEAR = Object.freeze({
  2024: 4_800_000,
  2025: 4_800_000,
  2026: 4_800_000,
});

export const SIMPLES_SUBLIMITE_ICMS_ISS_REAIS_BY_YEAR = Object.freeze({
  2024: 3_600_000,
  2025: 3_600_000,
  2026: 3_600_000,
});

export const MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR = Object.freeze({
  2024: 'Referência 2024',
  2025: 'Referência 2025',
  2026: 'Referência 2026',
});

export const SIMPLES_LIMITE_VIGENCIA_LABEL_BY_YEAR = Object.freeze({
  2024: 'Simples Nacional · 2024',
  2025: 'Simples Nacional · 2025',
  2026: 'Simples Nacional · 2026',
});

export const DEFAULT_MEI_LIMITE_THRESHOLDS = Object.freeze({
  atencaoMinPercent: 80,
  criticoMinPercent: 95,
});

function pickYearAmount(map, anoCivil) {
  const v = map[anoCivil];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** @param {number} anoCivil @param {'mei'|'simples'} [regime] */
export function getLimiteReferenciaReaisParaAno(anoCivil, regime = 'mei') {
  if (regime === 'simples') {
    return pickYearAmount(SIMPLES_LIMITE_REFERENCIA_REAIS_BY_YEAR, anoCivil);
  }
  return pickYearAmount(MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR, anoCivil);
}

/** @param {number} anoCivil */
export function getSublimiteIcmsIssReaisParaAno(anoCivil) {
  return pickYearAmount(SIMPLES_SUBLIMITE_ICMS_ISS_REAIS_BY_YEAR, anoCivil);
}

/** @param {number} anoCivil @param {'mei'|'simples'} [regime] */
export function getVigenciaLabelParaAno(anoCivil, regime = 'mei') {
  const map = regime === 'simples'
    ? SIMPLES_LIMITE_VIGENCIA_LABEL_BY_YEAR
    : MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR;
  const label = map[anoCivil];
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}
