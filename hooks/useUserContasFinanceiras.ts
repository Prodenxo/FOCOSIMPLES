import { useEffect, useMemo } from 'react'
import { useContaFinanceiraStore } from '../store/contaFinanceiraStore'
import {
  buildContaNameMap,
  computeSaldosByConta,
  sumSaldosContas,
} from '../lib/contaFinanceiraIntegration'
import type { LancamentoSaldoSlice } from '../lib/contaSaldo'
import type { ContaFinanceira } from '../lib/contaFinanceiraTypes'
import { pickDefaultContaFinanceira } from '../lib/contaFinanceiraDefault'

export function useUserContasFinanceiras(
  userId: string | null,
  lancamentos: LancamentoSaldoSlice[],
) {
  const { contas, loading, error, fetchContas } = useContaFinanceiraStore()

  useEffect(() => {
    if (userId) void fetchContas()
  }, [userId, fetchContas])

  const contasAtivas = useMemo(
    () => contas.filter((c) => c.ativo),
    [contas],
  )

  const contaNameById = useMemo(
    () => buildContaNameMap(contasAtivas),
    [contasAtivas],
  )

  const saldosByContaId = useMemo(
    () => computeSaldosByConta(contasAtivas, lancamentos),
    [contasAtivas, lancamentos],
  )

  const totalSaldoContas = useMemo(
    () => sumSaldosContas(contasAtivas, lancamentos),
    [contasAtivas, lancamentos],
  )

  const contasComSaldo = useMemo(
    () =>
      contasAtivas.map((c) => ({
        ...c,
        saldoAtual: saldosByContaId[c.id] ?? c.saldo_inicial,
      })),
    [contasAtivas, saldosByContaId],
  )

  const defaultContaId = useMemo((): string | null => {
    return pickDefaultContaFinanceira(contasAtivas)?.id ?? null
  }, [contasAtivas])

  return {
    contas,
    contasAtivas,
    contasComSaldo,
    contaNameById,
    saldosByContaId,
    totalSaldoContas,
    defaultContaId,
    loading,
    error,
    refetch: fetchContas,
  }
}

export type ContaComSaldo = ContaFinanceira & { saldoAtual: number }
