import { normalizarTipo, normalizarValor } from './dashboardUtils';
import {
  formatSectionDateLabel,
  formatYmdToBr,
  matchesTransactionPeriod,
  parseTransactionDate,
  ymdFromDate,
} from './transactionPeriodFilter';

export function buildDuplicateTransactionDraft(tx) {
  if (!tx) return null;
  const copy = { ...tx };
  delete copy.id;
  delete copy.criado_em;
  delete copy.recorrencia_id;
  delete copy.recorrencia_ano_mes;
  copy._draftDuplicate = true;
  return copy;
}

export function resolveTransactionOrigin(tx) {
  const obs = String(tx?.obs || '').toLowerCase();
  if (obs.includes('whatsapp')) return 'WhatsApp';
  if (obs.includes('import')) return 'Importação';
  if (obs.includes('api') || obs.includes('bot')) return 'Automação';
  return null;
}

export function getTransactionSubtitle(tx) {
  const origin = resolveTransactionOrigin(tx);
  if (origin) return `via ${origin}`;
  const obs = String(tx?.obs || '').trim();
  if (obs) return obs.length > 48 ? `${obs.slice(0, 48)}…` : obs;
  return null;
}

export function getStatusMeta(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pago') {
    return { label: 'Pago', tone: 'success' };
  }
  if (s === 'recebido') {
    return { label: 'Recebido', tone: 'success' };
  }
  if (s === 'a_pagar') {
    return { label: 'A pagar', tone: 'warning' };
  }
  if (s === 'a_receber') {
    return { label: 'A receber', tone: 'warning' };
  }
  if (!s) return { label: '—', tone: 'muted' };
  return { label: s, tone: 'muted' };
}

export function isRealizedStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'pago' || s === 'recebido';
}

export function formatTransactionDateDisplay(tx) {
  const raw = tx?.data ? String(tx.data).slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatYmdToBr(raw);
  if (tx?.criado_em) {
    return new Date(tx.criado_em).toLocaleDateString('pt-BR');
  }
  return '—';
}

export function getTransactionYmd(tx) {
  const raw = tx?.data ? String(tx.data).slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (tx?.criado_em) return ymdFromDate(new Date(tx.criado_em));
  return ymdFromDate();
}

export function computePeriodKpis(list) {
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

  const saldo = entradas - saidas;
  let saldoTone = 'neutral';
  if (saldo > 0) saldoTone = 'positive';
  if (saldo < 0) saldoTone = 'negative';

  return {
    entradas,
    saidas,
    saldo,
    saldoTone,
    countEntradas,
    countSaidas,
  };
}

export function matchesSearch(item, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const inClass = String(item.classificacao || '').toLowerCase().includes(q);
  const inObs = String(item.obs || '').toLowerCase().includes(q);
  return inClass || inObs;
}

export function matchesTypeFilter(item, typeFilter) {
  if (typeFilter === 'all') return true;
  const isEntrada = normalizarTipo(item.tipo) === 'entrada';
  if (typeFilter === 'entrada') return isEntrada;
  return !isEntrada;
}

export function matchesStatusFilter(item, statusFilter) {
  if (statusFilter === 'all') return true;
  const realized = isRealizedStatus(item.status);
  if (statusFilter === 'pago') return realized;
  return !realized;
}

export function filterTransactions(list, filters) {
  const {
    periodOptions,
    search,
    typeFilter,
    statusFilter,
  } = filters;

  return list.filter((t) => {
    if (!matchesTransactionPeriod(t, periodOptions)) return false;
    if (!matchesSearch(t, search)) return false;
    if (!matchesTypeFilter(t, typeFilter)) return false;
    if (!matchesStatusFilter(t, statusFilter)) return false;
    return true;
  });
}

export function groupTransactionsByDay(list) {
  const groups = {};
  for (const t of list) {
    const ymd = getTransactionYmd(t);
    if (!groups[ymd]) groups[ymd] = [];
    groups[ymd].push(t);
  }

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => ({
      date: dateKey,
      label: formatSectionDateLabel(dateKey),
      items: groups[dateKey].sort((a, b) => {
        const da = parseTransactionDate(a).getTime();
        const db = parseTransactionDate(b).getTime();
        return db - da;
      }),
    }));
}

export function normalizeStatusForSave(tipo, realized) {
  const isEntrada = normalizarTipo(tipo) === 'entrada';
  if (isEntrada) return realized ? 'recebido' : 'a_receber';
  return realized ? 'pago' : 'a_pagar';
}

export function parseCurrencyInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function formatCurrencyInput(value) {
  const n = typeof value === 'number' ? value : parseCurrencyInput(value);
  if (!n) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBrDateToIso(br) {
  const m = String(br || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const test = new Date(`${iso}T00:00:00`);
  if (
    test.getFullYear() !== Number(m[3])
    || test.getMonth() + 1 !== Number(m[2])
    || test.getDate() !== Number(m[1])
  ) {
    return null;
  }
  return iso;
}

export function isoToBrDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}
