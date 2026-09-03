const TZ = 'America/Sao_Paulo';

const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export const foldPt = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const brasiliaYmd = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const addDaysYmd = (ymd, days) => {
  const [year, month, day] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

export const monthRange = (year, month) => {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(last).padStart(2, '0')}`,
    label: `${mm}/${year}`,
  };
};

export const parseBrDate = (raw, fallbackYear) => {
  const match = String(raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const day = String(match[1]).padStart(2, '0');
  const month = String(match[2]).padStart(2, '0');
  let year = match[3];
  if (!year) year = String(fallbackYear);
  else if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
};

export const resolvePeriodFromText = (text, now = new Date()) => {
  const t = foldPt(text);
  if (!t) return null;
  const today = brasiliaYmd(now);
  const [cy, cm] = today.split('-').map(Number);

  const range = t.match(
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:ate|a|–|-)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/,
  );
  if (range) {
    const from = parseBrDate(range[1], cy);
    const to = parseBrDate(range[2], cy);
    if (from && to) {
      return { from, to, label: `${range[1]} a ${range[2]}` };
    }
  }

  if (/\b(mes passado|ultimo mes)\b/.test(t)) {
    const prev = cm === 1 ? { y: cy - 1, m: 12 } : { y: cy, m: cm - 1 };
    return { ...monthRange(prev.y, prev.m), label: 'mês passado' };
  }
  if (/\b(este mes|esse mes|neste mes|mes atual)\b/.test(t)) {
    return { ...monthRange(cy, cm), label: 'este mês' };
  }
  if (/\bhoje\b/.test(t)) {
    return { from: today, to: today, label: 'hoje' };
  }
  if (/\bontem\b/.test(t)) {
    const ymd = addDaysYmd(today, -1);
    return { from: ymd, to: ymd, label: 'ontem' };
  }

  for (const [name, month] of Object.entries(MONTHS)) {
    if (!t.includes(name)) continue;
    const yearMatch = t.match(new RegExp(`${name}\\s*(?:de\\s*)?(\\d{4})`));
    let year = yearMatch ? Number(yearMatch[1]) : cy;
    if (!yearMatch && month > cm) year = cy - 1;
    return { ...monthRange(year, month), label: name };
  }

  return null;
};

export const txDateKey = (tx) => {
  const raw = tx?.data;
  if (!raw) return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const text = String(raw);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return text.slice(0, 10);
};

const money = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const normalizeTipo = (tipo) => {
  const t = foldPt(tipo);
  if (t === 'saida') return 'saida';
  if (t === 'entrada') return 'entrada';
  return t;
};

export const summarizeTransactions = (rows, { from, to, tipo } = {}) => {
  const wanted = tipo ? normalizeTipo(tipo) : '';
  const filtered = [];
  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const tx of rows || []) {
    const key = txDateKey(tx);
    if (from && key && key < from) continue;
    if (to && key && key > to) continue;
    if (!key && (from || to)) continue;
    const txTipo = normalizeTipo(tx?.tipo);
    if (wanted && txTipo !== wanted) continue;
    filtered.push(tx);
    const valor = toNumber(tx?.valor);
    if (txTipo === 'entrada') totalEntradas += valor;
    if (txTipo === 'saida') totalSaidas += valor;
  }
  return {
    transactions: filtered,
    totalEntradas,
    totalSaidas,
    from: from || null,
    to: to || null,
    tipo: wanted || null,
    count: filtered.length,
  };
};

export const formatPeriodSummaryMessage = (summary) => {
  const from = summary?.from;
  const to = summary?.to;
  const tipo = summary?.tipo;
  const entradas = money(summary?.totalEntradas);
  const saidas = money(summary?.totalSaidas);
  const when = from && to
    ? (from === to ? `em ${from.split('-').reverse().join('/')}` : `de ${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}`)
    : 'no período';

  if (tipo === 'saida') {
    return `Você gastou ${saidas} ${when} (${summary.count} saída${summary.count === 1 ? '' : 's'}).`;
  }
  if (tipo === 'entrada') {
    return `Você recebeu ${entradas} ${when} (${summary.count} entrada${summary.count === 1 ? '' : 's'}).`;
  }
  return `Movimento ${when}: gastou ${saidas}, recebeu ${entradas} (${summary.count} lançamento${summary.count === 1 ? '' : 's'}).`;
};
