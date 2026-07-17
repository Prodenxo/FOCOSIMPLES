import { normalizarTipo, normalizarValor } from './dashboardUtils'

export type LancamentoSaldoSlice = {
  conta_id?: string | null
  tipo: string
  valor: number | string
  status: string
}

export const REALIZED_LANCAMENTO_STATUS = new Set(['pago', 'recebido'])

const REALIZED_STATUS = REALIZED_LANCAMENTO_STATUS

export function isRealizedLancamentoStatus(status: string | null | undefined): boolean {
  return REALIZED_STATUS.has(String(status || '').toLowerCase())
}

/** Saldo atual = saldo inicial + entradas realizadas − saídas realizadas vinculadas à conta. */
export function computeContaSaldoAtual(
  saldoInicial: number,
  lancamentos: LancamentoSaldoSlice[],
  contaId: string,
): number {
  let delta = 0
  for (const tx of lancamentos) {
    if (!tx.conta_id || String(tx.conta_id) !== contaId) continue
    if (!REALIZED_STATUS.has(String(tx.status || '').toLowerCase())) continue
    const valor = normalizarValor(tx.valor)
    const tipo = normalizarTipo(tx.tipo)
    if (tipo === 'entrada') delta += valor
    else delta -= valor
  }
  return saldoInicial + delta
}
