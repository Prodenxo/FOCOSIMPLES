import { normalizarTipo, normalizarValor, parsearData } from '../../lib/dashboardUtils';
import { isRealizedLancamentoStatus } from '../../lib/contaSaldo';
import { isInSelectedMonth, parseTransactionDate } from '../../lib/transactionPeriodFilter';

export type DashboardInsight = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'positive' | 'negative' | 'accent';
  icon: 'analytics' | 'swap' | 'receipt' | 'time' | 'wallet' | 'alert';
};

type Tx = {
  data?: string | null;
  criado_em?: string | null;
  tipo?: string | null;
  valor?: number | string | null;
  status?: string | null;
  classificacao?: string | null;
  categoria?: string | number | null;
};

function filterMonth(list: Tx[], year: number, month: number) {
  const selectedMonth = { year, month };
  return list.filter((t) => isInSelectedMonth(t, selectedMonth));
}

function sumByTipo(list: Tx[], tipo: 'entrada' | 'saida') {
  return list
    .filter((t) => normalizarTipo(t.tipo) === tipo)
    .reduce((s, t) => s + normalizarValor(t.valor), 0);
}

function formatBrl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPct(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}

function prevMonth(year: number, month: number) {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function buildDashboardInsights(
  transactions: Tx[],
  selectedYear: number,
  selectedMonth: number,
  categoriasMap: Record<string, string>,
): DashboardInsight[] {
  const current = filterMonth(transactions, selectedYear, selectedMonth);
  const prev = prevMonth(selectedYear, selectedMonth);
  const previous = filterMonth(transactions, prev.year, prev.month);

  const income = sumByTipo(current, 'entrada');
  const expenses = sumByTipo(current, 'saida');
  const net = income - expenses;
  const prevExpenses = sumByTipo(previous, 'saida');
  const expenseDelta =
    prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : null;

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const avgDaily = daysInMonth > 0 ? expenses / daysInMonth : 0;

  const pending = current.filter(
    (t) => normalizarTipo(t.tipo) === 'saida' && t.status === 'a_pagar',
  );
  const pendingTotal = pending.reduce((s, t) => s + normalizarValor(t.valor), 0);

  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  const insights: DashboardInsight[] = [
    {
      id: 'net',
      label: 'Saldo do mês',
      value: formatBrl(net),
      hint: net >= 0 ? 'Entrou mais do que saiu' : 'Gastou mais do que entrou',
      tone: net >= 0 ? 'positive' : 'negative',
      icon: 'analytics',
    },
    {
      id: 'savings',
      label: 'Quanto sobrou',
      value: `${Math.round(savingsRate)}%`,
      hint: 'Do total que entrou, quanto ficou',
      tone: savingsRate >= 20 ? 'positive' : savingsRate < 0 ? 'negative' : 'neutral',
      icon: 'wallet',
    },
    {
      id: 'avg',
      label: 'Gasto por dia',
      value: formatBrl(avgDaily),
      hint: `Média de despesas nos ${daysInMonth} dias do mês`,
      tone: 'neutral',
      icon: 'time',
    },
    {
      id: 'pending',
      label: 'A pagar',
      value: formatBrl(pendingTotal),
      hint: `${pending.length} conta${pending.length === 1 ? '' : 's'} ainda não paga${pending.length === 1 ? '' : 's'}`,
      tone: pendingTotal > 0 ? 'negative' : 'positive',
      icon: 'alert',
    },
    {
      id: 'tx',
      label: 'Lançamentos',
      value: String(current.length),
      hint: 'Entradas e saídas registradas no mês',
      tone: 'accent',
      icon: 'receipt',
    },
  ];

  if (expenseDelta !== null) {
    insights.push({
      id: 'delta',
      label: 'Gastos vs mês passado',
      value: formatPct(expenseDelta),
      hint: `Mês passado: ${formatBrl(prevExpenses)}`,
      tone: expenseDelta <= 0 ? 'positive' : 'negative',
      icon: 'swap',
    });
  }

  return insights;
}

export type RecentActivityItem = {
  id: string;
  title: string;
  categoryId: string | number;
  dateLabel: string;
  amount: string;
  tipo: 'entrada' | 'saida';
  status?: string | null;
};

export type DailyFlowDay = {
  dayKey: string;
  dayLabel: string;
  income: number;
  expense: number;
};

const MONTH_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

function toDayKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayLabel(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const monthShort = MONTH_SHORT[date.getMonth()] ?? String(date.getMonth() + 1);
  return `Hoje · ${dd} ${monthShort}`;
}

/** Agrega entradas e saídas realizadas no dia atual (timezone local). */
export function buildTodayFlow(
  transactions: Tx[],
  referenceDate: Date = new Date(),
): DailyFlowDay {
  const dayKey = toDayKey(referenceDate);
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    if (!isRealizedLancamentoStatus(t.status)) continue;

    const d = parseTransactionDate(t);
    if (toDayKey(d) !== dayKey) continue;

    const valor = normalizarValor(t.valor);
    if (normalizarTipo(t.tipo) === 'entrada') {
      income += valor;
    } else {
      expense += valor;
    }
  }

  return {
    dayKey,
    dayLabel: formatDayLabel(referenceDate),
    income,
    expense,
  };
}

/** Agrega entradas e saídas realizadas por dia no mês selecionado (só dias com movimentação). */
export function buildDailyFlow(
  transactions: Tx[],
  selectedYear: number,
  selectedMonth: number,
): DailyFlowDay[] {
  const current = filterMonth(transactions, selectedYear, selectedMonth);
  const byDay = new Map<string, { income: number; expense: number }>();

  for (const t of current) {
    if (!isRealizedLancamentoStatus(t.status)) continue;

    const d = parseTransactionDate(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const bucket = byDay.get(key) ?? { income: 0, expense: 0 };
    const valor = normalizarValor(t.valor);
    if (normalizarTipo(t.tipo) === 'entrada') {
      bucket.income += valor;
    } else {
      bucket.expense += valor;
    }
    byDay.set(key, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, totals]) => {
      const [, mm, dd] = dayKey.split('-');
      const monthIndex = Number(mm) - 1;
      const monthShort = [
        'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
        'jul', 'ago', 'set', 'out', 'nov', 'dez',
      ][monthIndex] ?? mm;
      return {
        dayKey,
        dayLabel: `${dd} ${monthShort}`,
        income: totals.income,
        expense: totals.expense,
      };
    });
}

export function buildRecentActivity(
  transactions: Tx[],
  selectedYear: number,
  selectedMonth: number,
  categoriasMap: Record<string, string>,
  limit = 6,
): RecentActivityItem[] {
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
    const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return {
      id: `${t.data}-${index}-${valor}`,
      title: String(title),
      categoryId: catKey,
      dateLabel,
      amount: formatBrl(valor),
      tipo,
      status: t.status,
    };
  });
}
