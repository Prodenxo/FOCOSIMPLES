import { normalizarTipo, normalizarValor } from './dashboardUtils';

export const REALIZED_LANCAMENTO_STATUS = new Set(['pago', 'recebido']);

export function isRealizedLancamentoStatus(status) {
  return REALIZED_LANCAMENTO_STATUS.has(String(status || '').toLowerCase());
}

export function computeContaSaldoAtual(saldoInicial, lancamentos, contaId) {
  let delta = 0;
  for (const tx of lancamentos) {
    if (!tx.conta_id || String(tx.conta_id) !== contaId) continue;
    if (!isRealizedLancamentoStatus(tx.status)) continue;
    const valor = normalizarValor(tx.valor);
    const tipo = normalizarTipo(tx.tipo);
    if (tipo === 'entrada') delta += valor;
    else delta -= valor;
  }
  return saldoInicial + delta;
}
