import {
  DEFAULT_MEI_LIMITE_THRESHOLDS,
  getLimiteReferenciaReaisParaAno,
  getSublimiteIcmsIssReaisParaAno,
} from '@/lib/meiLimiteFaturamentoConfig';

function clampBarPercent(raw) {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, raw));
}

function resolveBanda(percentual, thresholds) {
  if (percentual === null || !Number.isFinite(percentual)) return 'indeterminado';
  if (percentual >= thresholds.criticoMinPercent) return 'critico';
  if (percentual >= thresholds.atencaoMinPercent) return 'atencao';
  return 'seguro';
}

/**
 * Calcula progresso do limite de faturamento (usa agregado do servidor quando disponível).
 * @param {unknown[]} _records
 * @param {{
 *   anoCivil: number,
 *   regime?: 'mei'|'simples',
 *   agregadoServidor?: { totalUtilizadoReais: number, notasConsideradas: number },
 * }} options
 */
export function computeMeiLimiteProgresso(_records, options) {
  const regime = options.regime ?? 'mei';
  const thresholds = options.thresholds ?? DEFAULT_MEI_LIMITE_THRESHOLDS;

  let total = 0;
  let notasConsideradas = 0;
  if (options.agregadoServidor) {
    total = options.agregadoServidor.totalUtilizadoReais;
    notasConsideradas = options.agregadoServidor.notasConsideradas;
  }

  const limite = getLimiteReferenciaReaisParaAno(options.anoCivil, regime);

  let percentual = null;
  let paraBarra = null;
  if (limite !== null && limite > 0) {
    percentual = (total / limite) * 100;
    paraBarra = clampBarPercent(percentual);
  }

  let sublimite = null;
  let percentualSublimite = null;
  let percentualSublimiteParaBarra = null;
  let atingiuSublimite = false;
  if (regime === 'simples') {
    sublimite = getSublimiteIcmsIssReaisParaAno(options.anoCivil);
    if (sublimite !== null && sublimite > 0) {
      percentualSublimite = (total / sublimite) * 100;
      percentualSublimiteParaBarra = clampBarPercent(percentualSublimite);
      atingiuSublimite = total >= sublimite;
    }
  }

  const banda = limite === null || limite <= 0
    ? 'indeterminado'
    : resolveBanda(percentual, thresholds);

  return {
    anoCivil: options.anoCivil,
    totalUtilizadoReais: total,
    limiteReferenciaReais: limite,
    percentualUtilizado: percentual,
    percentualUtilizadoParaBarra: paraBarra,
    banda,
    notasConsideradas,
    sublimiteReais: sublimite,
    percentualSublimite,
    percentualSublimiteParaBarra,
    atingiuSublimite,
    regime,
  };
}
