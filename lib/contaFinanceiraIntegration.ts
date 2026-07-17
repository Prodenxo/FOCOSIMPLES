import { normalizarTipo, normalizarValor } from './dashboardUtils'
import {
  computeContaSaldoAtual,
  isRealizedLancamentoStatus,
  type LancamentoSaldoSlice,
} from './contaSaldo'
import type { ContaFinanceira } from './contaFinanceiraTypes'

export type ContaFilterValue = 'all' | 'unassigned' | string

export type TxContaSlice = LancamentoSaldoSlice & {
  data?: string | null
  criado_em?: string | null
  classificacao?: string | null
  obs?: string | null
}

export function buildContaNameMap(contas: ContaFinanceira[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of contas) {
    if (c.ativo) map[c.id] = c.nome
  }
  return map
}

export function computeSaldosByConta(
  contas: ContaFinanceira[],
  lancamentos: LancamentoSaldoSlice[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of contas.filter((x) => x.ativo)) {
    out[c.id] = computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id)
  }
  return out
}

export function sumSaldosContas(
  contas: ContaFinanceira[],
  lancamentos: LancamentoSaldoSlice[],
): number {
  return contas
    .filter((c) => c.ativo)
    .reduce((sum, c) => sum + computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id), 0)
}

/** Lançamentos sem conta vinculada (realizados) — legado / migração. */
export function sumUnassignedRealizedDelta(lancamentos: LancamentoSaldoSlice[]): number {
  let delta = 0
  for (const tx of lancamentos) {
    if (tx.conta_id) continue
    if (!isRealizedLancamentoStatus(tx.status)) continue
    const v = normalizarValor(tx.valor)
    delta += normalizarTipo(tx.tipo) === 'entrada' ? v : -v
  }
  return delta
}

export function matchesContaFilter(
  tx: { conta_id?: string | null },
  filter: ContaFilterValue,
): boolean {
  if (filter === 'all') return true
  if (filter === 'unassigned') return !tx.conta_id
  return String(tx.conta_id || '') === filter
}

export function filterTransactionsByConta<T extends { conta_id?: string | null }>(
  list: T[],
  filter: ContaFilterValue,
): T[] {
  if (filter === 'all') return list
  return list.filter((t) => matchesContaFilter(t, filter))
}

export function filterByMonthPrefix<T extends { data?: string | null }>(
  list: T[],
  monthPrefix: string,
): T[] {
  return list.filter((t) => String(t.data || '').startsWith(monthPrefix))
}

export function computeMonthFlowKpis(
  list: TxContaSlice[],
): {
  entradas: number
  saidas: number
  saldo: number
  countEntradas: number
  countSaidas: number
} {
  const isEntrada = (t: TxContaSlice) => normalizarTipo(t.tipo) === 'entrada'
  const valorOf = (t: TxContaSlice) => normalizarValor(t.valor)
  const entradas = list.filter(isEntrada).reduce((s, t) => s + valorOf(t), 0)
  const saidas = list.filter((t) => !isEntrada(t)).reduce((s, t) => s + valorOf(t), 0)
  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    countEntradas: list.filter(isEntrada).length,
    countSaidas: list.filter((t) => !isEntrada(t)).length,
  }
}

/** Saldo exibido no dashboard conforme o filtro de conta ativo. */
export function resolveDashboardBalance(
  contas: ContaFinanceira[],
  lancamentos: LancamentoSaldoSlice[],
  legacyAllTxBalance: number,
  filter: ContaFilterValue,
): { value: number; mode: 'contas' | 'legacy' | 'unassigned' } {
  const ativas = contas.filter((c) => c.ativo)

  if (filter === 'unassigned') {
    return { value: sumUnassignedRealizedDelta(lancamentos), mode: 'unassigned' }
  }

  if (filter !== 'all') {
    const conta = ativas.find((c) => c.id === filter)
    if (conta) {
      return {
        value: computeContaSaldoAtual(conta.saldo_inicial, lancamentos, filter),
        mode: 'contas',
      }
    }
  }

  if (ativas.length === 0) {
    return { value: legacyAllTxBalance, mode: 'legacy' }
  }

  let total = sumSaldosContas(ativas, lancamentos)
  if (filter === 'all') {
    total += sumUnassignedRealizedDelta(lancamentos)
  }
  return { value: total, mode: 'contas' }
}
