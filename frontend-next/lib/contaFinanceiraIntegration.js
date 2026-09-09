import { normalizarTipo, normalizarValor } from './dashboardUtils';
import { computeContaSaldoAtual, isRealizedLancamentoStatus } from './contaSaldo';

export function buildContaNameMap(contas) {
  const map = {};
  for (const c of contas) {
    if (c.ativo) map[c.id] = c.nome;
  }
  return map;
}

export function sumSaldosContas(contas, lancamentos) {
  return contas
    .filter((c) => c.ativo)
    .reduce((sum, c) => sum + computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id), 0);
}

export function sumUnassignedRealizedDelta(lancamentos) {
  let delta = 0;
  for (const tx of lancamentos) {
    if (tx.conta_id) continue;
    if (!isRealizedLancamentoStatus(tx.status)) continue;
    const v = normalizarValor(tx.valor);
    delta += normalizarTipo(tx.tipo) === 'entrada' ? v : -v;
  }
  return delta;
}

export function filterTransactionsByConta(list, filter) {
  if (filter === 'all') return list;
  if (filter === 'unassigned') return list.filter((t) => !t.conta_id);
  return list.filter((t) => String(t.conta_id || '') === filter);
}

export function computeMonthFlowKpis(list) {
  let entradas = 0;
  let saidas = 0;
  let countEntradas = 0;
  let countSaidas = 0;

  for (const t of list) {
    const valor = normalizarValor(t.valor);
    if (normalizarTipo(t.tipo) === 'entrada') {
      entradas += valor;
      countEntradas += 1;
    } else {
      saidas += valor;
      countSaidas += 1;
    }
  }

  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    countEntradas,
    countSaidas,
  };
}

export function resolveDashboardBalance(contas, lancamentos, legacyAllTxBalance, filter) {
  const ativas = contas.filter((c) => c.ativo);

  if (filter === 'unassigned') {
    return { value: sumUnassignedRealizedDelta(lancamentos), mode: 'unassigned' };
  }

  if (filter !== 'all') {
    const conta = ativas.find((c) => c.id === filter);
    if (conta) {
      return {
        value: computeContaSaldoAtual(conta.saldo_inicial, lancamentos, filter),
        mode: 'contas',
      };
    }
  }

  if (ativas.length === 0) {
    return { value: legacyAllTxBalance, mode: 'legacy' };
  }

  let total = sumSaldosContas(ativas, lancamentos);
  if (filter === 'all') {
    total += sumUnassignedRealizedDelta(lancamentos);
  }
  return { value: total, mode: 'contas' };
}
