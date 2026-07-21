/**
 * Configuração do limite de referência MEI / Simples Nacional (valor por ano civil).
 * Valores são referência administrativa para a UI; conferir legislação vigente.
 */

export type LimiteFaturamentoRegime = 'mei' | 'simples'

export const MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR: Readonly<Record<number, number>> =
  Object.freeze({
    2024: 81_000,
    2025: 81_000,
    2026: 81_000,
  })

/** Limite anual de receita bruta no Simples Nacional (art. LC 123). */
export const SIMPLES_LIMITE_REFERENCIA_REAIS_BY_YEAR: Readonly<Record<number, number>> =
  Object.freeze({
    2024: 4_800_000,
    2025: 4_800_000,
    2026: 4_800_000,
  })

/**
 * Sublimite de receita bruta para permanência no regime de apuração
 * de ICMS/ISS pelo Simples (referência LC 123 — conferir vigência).
 */
export const SIMPLES_SUBLIMITE_ICMS_ISS_REAIS_BY_YEAR: Readonly<Record<number, number>> =
  Object.freeze({
    2024: 3_600_000,
    2025: 3_600_000,
    2026: 3_600_000,
  })

export const MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR: Readonly<Record<number, string>> =
  Object.freeze({
    2024: 'Referência 2024',
    2025: 'Referência 2025',
    2026: 'Referência 2026',
  })

export const SIMPLES_LIMITE_VIGENCIA_LABEL_BY_YEAR: Readonly<Record<number, string>> =
  Object.freeze({
    2024: 'Simples Nacional · 2024',
    2025: 'Simples Nacional · 2025',
    2026: 'Simples Nacional · 2026',
  })

export interface MeiLimiteThresholds {
  atencaoMinPercent: number
  criticoMinPercent: number
}

export const DEFAULT_MEI_LIMITE_THRESHOLDS: MeiLimiteThresholds = Object.freeze({
  atencaoMinPercent: 80,
  criticoMinPercent: 95,
})

function pickYearAmount(
  map: Readonly<Record<number, number>>,
  anoCivil: number,
): number | null {
  const v = map[anoCivil]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

export function getLimiteReferenciaReaisParaAno(
  anoCivil: number,
  regime: LimiteFaturamentoRegime = 'mei',
): number | null {
  if (regime === 'simples') {
    return pickYearAmount(SIMPLES_LIMITE_REFERENCIA_REAIS_BY_YEAR, anoCivil)
  }
  return pickYearAmount(MEI_LIMITE_REFERENCIA_REAIS_BY_YEAR, anoCivil)
}

export function getSublimiteIcmsIssReaisParaAno(anoCivil: number): number | null {
  return pickYearAmount(SIMPLES_SUBLIMITE_ICMS_ISS_REAIS_BY_YEAR, anoCivil)
}

export function getVigenciaLabelParaAno(
  anoCivil: number,
  regime: LimiteFaturamentoRegime = 'mei',
): string | null {
  const map =
    regime === 'simples'
      ? SIMPLES_LIMITE_VIGENCIA_LABEL_BY_YEAR
      : MEI_LIMITE_VIGENCIA_LABEL_BY_YEAR
  const label = map[anoCivil]
  return typeof label === 'string' && label.trim() ? label.trim() : null
}
