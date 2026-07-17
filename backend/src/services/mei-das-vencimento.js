/**
 * Vencimento do DAS MEI: competência YYYY-MM vence no dia 20 do mês seguinte.
 * Ex.: competência 05/2026 → vencimento 20/06/2026.
 */

import { normalizeCompetencia } from './mei-period-status.service.js';

/** Mês/ano calendário em America/Sao_Paulo (1–12). */
export const brCalendarMonthYear = (refDate = new Date()) => {
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
};

/** Data civil YYYY-MM-DD em America/Sao_Paulo. */
export const brCalendarDateIso = (refDate = new Date()) => {
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * @param {string} competencia YYYY-MM ou AAAAMM
 * @returns {{ year: number, month: number, day: number, iso: string, display: string } | null}
 */
export const getDasVencimentoFromCompetencia = (competencia) => {
  const normalized = normalizeCompetencia(competencia);
  if (!normalized) return null;
  const [y, m] = normalized.split('-').map(Number);
  let vencMonth = m + 1;
  let vencYear = y;
  if (vencMonth > 12) {
    vencMonth = 1;
    vencYear += 1;
  }
  const iso = `${vencYear}-${String(vencMonth).padStart(2, '0')}-20`;
  const display = `20/${String(vencMonth).padStart(2, '0')}/${vencYear}`;
  return { year: vencYear, month: vencMonth, day: 20, iso, display };
};

/**
 * True se hoje (BR) é depois do dia 20 de vencimento da competência.
 * @param {string} competencia
 * @param {Date} [refDate]
 */
export const isDasCompetenciaVencida = (competencia, refDate = new Date()) => {
  const venc = getDasVencimentoFromCompetencia(competencia);
  if (!venc) return false;
  const todayIso = brCalendarDateIso(refDate);
  return todayIso > venc.iso;
};

/**
 * Enriquece item de período DAS com flags de vencimento.
 * @param {Record<string, unknown>} item
 * @param {Date} [refDate]
 */
export const enrichDasPeriodWithVencimento = (item, refDate = new Date()) => {
  if (!item || typeof item !== 'object') return item;
  const competencia = String(item.competencia || '');
  const venc = getDasVencimentoFromCompetencia(competencia);
  const status = String(item.status || '');
  const vencida = status === 'a_pagar' && isDasCompetenciaVencida(competencia, refDate);
  return {
    ...item,
    vencimento: venc?.display || null,
    vencimentoIso: venc?.iso || null,
    vencida,
  };
};
