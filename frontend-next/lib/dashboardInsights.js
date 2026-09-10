import { normalizarTipo, normalizarValor, parsearData } from './dashboardUtils';
import { isRealizedLancamentoStatus } from './contaSaldo';
import { isInSelectedMonth, parseTransactionDate } from './transactionPeriodFilter';
import { formatBrl } from './format';

function filterMonth(list, year, month) {
  return list.filter((t) => isInSelectedMonth(t, { year, month }));
}

function sumByTipo(list, tipo) {
  return list
    .filter((t) => normalizarTipo(t.tipo) === tipo)
    .reduce((s, t) => s + normalizarValor(t.valor), 0);
}

function prevMonth(year, month) {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** KPIs mensais — mesma lógica do Expo (`dashboardInsights.ts`). */
export function buildDashboardInsights(transactions, selectedYear, selectedMonth) {
  const current = filterMonth(transactions, selectedYear, selectedMonth);
  const prev = prevMonth(selectedYear, selectedMonth);
  const previous = filterMonth(transactions, prev.year, prev.month);

  const income = sumByTipo(current, 'entrada');
  const expenses = sumByTipo(current, 'saida');
  const net = income - expenses;

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const avgDaily = daysInMonth > 0 ? expenses / daysInMonth : 0;

  const pending = current.filter(
    (t) => normalizarTipo(t.tipo) === 'saida' && t.status === 'a_pagar',
  );
  const pendingTotal = pending.reduce((s, t) => s + normalizarValor(t.valor), 0);
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  return {
    saldoMes: net,
    quantoSobrouPct: savingsRate,
    gastoPorDia: avgDaily,
    aPagar: pendingTotal,
    aPagarCount: pending.length,
    lancamentosCount: current.length,
  };
}

const MONTH_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function toDayKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildTodayFlow(transactions, referenceDate = new Date()) {
  const dayKey = toDayKey(referenceDate);
  let income = 0;
  let expense = 0;
  const items = [];

  for (const t of transactions) {
    if (!isRealizedLancamentoStatus(t.status)) continue;
    const d = parseTransactionDate(t);
    if (toDayKey(d) !== dayKey) continue;

    const valor = normalizarValor(t.valor);
    const tipo = normalizarTipo(t.tipo);
    if (tipo === 'entrada') income += valor;
    else expense += valor;

    items.push({
      id: String(t.id || `${t.data}-${valor}`),
      title: t.classificacao || 'Lançamento',
      amount: formatBrl(valor),
      tipo,
      dateLabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    });
  }

  items.sort((a, b) => b.dateLabel.localeCompare(a.dateLabel));

  return { income, expense, items };
}

export function buildRecentActivity(
  transactions,
  selectedYear,
  selectedMonth,
  categoriasMap,
  limit = 6,
) {
  const current = filterMonth(transactions, selectedYear, selectedMonth);
  const sorted = [...current].sort((a, b) => {
    const da = parsearData(a.data, a.criado_em).getTime();
    const db = parsearData(b.data, b.criado_em).getTime();
    return db - da;
  });

  return sorted.slice(0, limit).map((t, index) => {
    const tipo = normalizarTipo(t.tipo);
    const valor = normalizarValor(t.valor);
    let catKey = t.categoria ? String(t.categoria) : String(t.classificacao || '');
    if (!catKey || catKey === 'NaN') catKey = 'sem-categoria';
    const title = categoriasMap[catKey] || t.classificacao || 'Lançamento';
    const d = parsearData(t.data, t.criado_em);
    return {
      id: `${t.id || t.data}-${index}`,
      title: String(title),
      dateLabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      amount: formatBrl(valor),
      tipo,
    };
  });
}

export function computeMonthExpenseTotals(monthTransactions) {
  const despesas = monthTransactions.filter((t) => normalizarTipo(t.tipo) === 'saida');
  const pagos = despesas
    .filter((t) => t.status === 'pago')
    .reduce((s, t) => s + normalizarValor(t.valor), 0);
  const aPagar = despesas
    .filter((t) => t.status === 'a_pagar')
    .reduce((s, t) => s + normalizarValor(t.valor), 0);
  return { pagos, aPagar };
}
