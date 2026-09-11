export function normalizarTipo(tipo) {
  const t = String(tipo || '').toLowerCase().trim();
  return t === 'entrada' ? 'entrada' : 'saida';
}

export function normalizeCategoryKey(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function mergeCategoriesByName(list) {
  const byKey = new Map();
  for (const cat of list) {
    const tipo = cat.tipo === 'entrada' ? 'entrada' : 'saida';
    const key = `${String(cat.nome || '').trim().toLowerCase()}:${tipo}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cat);
      continue;
    }
    if (existing.user_id == null && cat.user_id != null) {
      byKey.set(key, cat);
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  );
}

export function getMonthRange({ year, month }) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startOfMonth: start.toISOString().split('T')[0],
    endOfMonth: end.toISOString().split('T')[0],
  };
}

export function formatMonthLabelPt({ year, month }) {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${cap} de ${year}`;
}

export function shiftMonth(ref, delta) {
  const d = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function isEligibleTransaction(tx, viewTipo) {
  if (normalizarTipo(tx.tipo) !== viewTipo) return false;
  if (viewTipo === 'entrada') return tx.status === 'recebido';
  return true;
}

export function transactionsForCategory(nome, viewTipo, monthTransactions) {
  const key = normalizeCategoryKey(nome);
  return monthTransactions.filter((tx) => {
    if (normalizarTipo(tx.tipo) !== viewTipo) return false;
    return normalizeCategoryKey(tx.classificacao) === key;
  });
}

export function eligibleTransactionsForCategory(nome, viewTipo, monthTransactions) {
  const key = normalizeCategoryKey(nome);
  return monthTransactions.filter((tx) => {
    if (!isEligibleTransaction(tx, viewTipo)) return false;
    return normalizeCategoryKey(tx.classificacao) === key;
  });
}
