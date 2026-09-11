import { formatMonthLabelPt, shiftMonth } from '@/lib/categoryUtils';

export { formatMonthLabelPt, shiftMonth };

export function normalizeTipo(tipo) {
  return String(tipo || '').toLowerCase().trim() === 'entrada' ? 'entrada' : 'saida';
}

export function getRealizado(summary, tipo) {
  if (!summary) return 0;
  return tipo === 'entrada'
    ? Number(summary.valor_recebido) || 0
    : Number(summary.valor_gasto) || 0;
}

export function buildBudgetRow(categoria, summary) {
  const tipo = normalizeTipo(categoria.tipo);
  const orcado = summary?.valor_orcado != null ? Number(summary.valor_orcado) : null;
  const realizado = getRealizado(summary, tipo);
  const metrics = computeBudgetMetrics(orcado, realizado, tipo);

  return {
    id: categoria.id,
    nome: categoria.nome,
    tipo,
    orcado,
    realizado,
    summary,
    ...metrics,
  };
}

export function computeBudgetMetrics(orcado, realizado, tipo) {
  const orcadoNum = typeof orcado === 'number' && !Number.isNaN(orcado) ? orcado : null;
  const realizadoNum = Number(realizado) || 0;

  if (orcadoNum == null || orcadoNum <= 0) {
    return {
      percentExact: null,
      percentDisplay: null,
      barWidth: 0,
      diff: null,
      statusKey: 'sem_orcamento',
      statusLabel: 'Sem orçamento',
      statusTone: 'muted',
    };
  }

  const percentExact = (realizadoNum / orcadoNum) * 100;
  const percentDisplay = Math.round(percentExact);
  const barWidth = Math.min(100, Math.max(0, percentExact));
  const diff = orcadoNum - realizadoNum;

  if (tipo === 'entrada') {
    if (realizadoNum > orcadoNum) {
      return {
        percentExact,
        percentDisplay,
        barWidth,
        diff: realizadoNum - orcadoNum,
        statusKey: 'meta_superada',
        statusLabel: 'Meta superada',
        statusTone: 'success',
        balanceLabel: 'Meta superada',
        balanceValue: realizadoNum - orcadoNum,
        balancePositive: true,
      };
    }
    if (realizadoNum === orcadoNum) {
      return {
        percentExact,
        percentDisplay,
        barWidth,
        diff: 0,
        statusKey: 'meta_atingida',
        statusLabel: 'Meta atingida',
        statusTone: 'success',
        balanceLabel: 'Meta atingida',
        balanceValue: 0,
        balancePositive: true,
      };
    }
    return {
      percentExact,
      percentDisplay,
      barWidth,
      diff,
      statusKey: 'em_andamento',
      statusLabel: 'Em andamento',
      statusTone: 'neutral',
      balanceLabel: 'Falta para a meta',
      balanceValue: diff,
      balancePositive: true,
    };
  }

  if (realizadoNum > orcadoNum) {
    return {
      percentExact,
      percentDisplay,
      barWidth,
      diff,
      statusKey: 'excedido',
      statusLabel: 'Limite excedido',
      statusTone: 'danger',
      balanceLabel: 'Excedido',
      balanceValue: realizadoNum - orcadoNum,
      balancePositive: false,
    };
  }
  if (realizadoNum === orcadoNum) {
    return {
      percentExact,
      percentDisplay,
      barWidth,
      diff: 0,
      statusKey: 'limite_atingido',
      statusLabel: 'Limite atingido',
      statusTone: 'warning',
      balanceLabel: 'Disponível',
      balanceValue: 0,
      balancePositive: true,
    };
  }
  if (realizadoNum >= orcadoNum * 0.8) {
    return {
      percentExact,
      percentDisplay,
      barWidth,
      diff,
      statusKey: 'proximo',
      statusLabel: 'Próximo do limite',
      statusTone: 'warning',
      balanceLabel: 'Disponível',
      balanceValue: diff,
      balancePositive: true,
    };
  }
  return {
    percentExact,
    percentDisplay,
    barWidth,
    diff,
    statusKey: 'dentro',
    statusLabel: 'Dentro do limite',
    statusTone: 'success',
    balanceLabel: 'Disponível',
    balanceValue: diff,
    balancePositive: true,
  };
}

export function computeTotals(rows) {
  let orcado = 0;
  let realizado = 0;
  for (const row of rows) {
    if (typeof row.orcado === 'number') orcado += row.orcado;
    realizado += row.realizado;
  }
  const diff = orcado - realizado;
  const percentExact = orcado > 0 ? (realizado / orcado) * 100 : null;
  return { orcado, realizado, diff, percentExact };
}

const STATUS_FILTERS_SAIDA = [
  { value: 'all', label: 'Todos os status' },
  { value: 'dentro', label: 'Dentro do limite' },
  { value: 'proximo', label: 'Próximo do limite' },
  { value: 'limite_atingido', label: 'Limite atingido' },
  { value: 'excedido', label: 'Limite excedido' },
];

const STATUS_FILTERS_ENTRADA = [
  { value: 'all', label: 'Todos os status' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'meta_atingida', label: 'Meta atingida' },
  { value: 'meta_superada', label: 'Meta superada' },
];

export function getStatusFilterOptions(viewTipo) {
  return viewTipo === 'entrada' ? STATUS_FILTERS_ENTRADA : STATUS_FILTERS_SAIDA;
}

export const SORT_OPTIONS = [
  { value: 'nome', label: 'Nome A – Z' },
  { value: 'realizado_desc', label: 'Maior realizado' },
  { value: 'percent_desc', label: 'Maior percentual' },
];

export function filterBudgetRows(rows, { searchTerm, statusFilter }) {
  const term = searchTerm.trim().toLowerCase();
  return rows.filter((row) => {
    if (term && !row.nome.toLowerCase().includes(term)) return false;
    if (statusFilter !== 'all' && row.statusKey !== statusFilter) return false;
    return true;
  });
}

export function sortBudgetRows(rows, sortBy) {
  const sorted = [...rows];
  if (sortBy === 'realizado_desc') {
    sorted.sort((a, b) => b.realizado - a.realizado || a.nome.localeCompare(b.nome, 'pt-BR'));
  } else if (sortBy === 'percent_desc') {
    sorted.sort((a, b) => {
      const pa = a.percentExact ?? -1;
      const pb = b.percentExact ?? -1;
      return pb - pa || a.nome.localeCompare(b.nome, 'pt-BR');
    });
  } else {
    sorted.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }
  return sorted;
}

export function paginateRows(rows, page, pageSize = 9) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: rows.slice(start, start + pageSize),
    total: rows.length,
  };
}

export function parseMoneyDigits(text) {
  const digits = String(text || '').replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits) / 100;
}

export function formatMoneyDigits(value) {
  if (value == null || Number.isNaN(value)) return '';
  const cents = Math.round(value * 100);
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatMoneyInputFromDigits(digits) {
  if (!digits) return '';
  const numeric = Number(digits);
  if (Number.isNaN(numeric)) return '';
  return (numeric / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function notifyBudgetsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('focosimples:budgets-updated'));
  }
}
