const REALIZED_STATUS = new Set(['pago', 'recebido']);

const normalizeTipo = (tipo) => {
  const t = String(tipo || '').toLowerCase();
  if (t === 'saída' || t === 'saida') return 'saida';
  if (t === 'entrada') return 'entrada';
  return t;
};

const normalizeValor = (valor) => {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Saldo = saldo_inicial + entradas realizadas − saídas realizadas da conta. */
export const computeContaSaldoAtual = (saldoInicial, lancamentos, contaId) => {
  let delta = 0;
  for (const tx of lancamentos || []) {
    if (!tx?.conta_id || String(tx.conta_id) !== String(contaId)) continue;
    if (!REALIZED_STATUS.has(String(tx.status || '').toLowerCase())) continue;
    const valor = normalizeValor(tx.valor);
    const tipo = normalizeTipo(tx.tipo);
    if (tipo === 'entrada') delta += valor;
    else if (tipo === 'saida') delta -= valor;
  }
  const base =
    typeof saldoInicial === 'number'
      ? saldoInicial
      : parseFloat(String(saldoInicial ?? 0)) || 0;
  return base + delta;
};

/** Lançamentos realizados sem `conta_id` (legado — aba "Meu financeiro" no dashboard). */
export const computeUnassignedSaldoDelta = (lancamentos) => {
  let delta = 0;
  for (const tx of lancamentos || []) {
    if (tx?.conta_id) continue;
    if (!REALIZED_STATUS.has(String(tx.status || '').toLowerCase())) continue;
    const valor = normalizeValor(tx.valor);
    const tipo = normalizeTipo(tx.tipo);
    if (tipo === 'entrada') delta += valor;
    else if (tipo === 'saida') delta -= valor;
  }
  return delta;
};

const formatMoneyBr = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

/** Mensagem legível para WhatsApp — saldo geral com detalhe por carteira. */
export const formatGetSaldoMessage = (summary, { filtered = false } = {}) => {
  const contas = summary?.contas || [];
  const semConta = Number(summary?.saldoSemConta) || 0;
  const total = Number(summary?.totalSaldo) || 0;

  if (filtered && contas.length === 1) {
    return `Saldo ${contas[0].nome}: ${formatMoneyBr(contas[0].saldoAtual)}.`;
  }

  const parts = contas.map((c) => `${c.nome}: ${formatMoneyBr(c.saldoAtual)}`);
  if (Math.abs(semConta) > 0.0001) {
    parts.push(`Meu Financeiro (sem carteira): ${formatMoneyBr(semConta)}`);
  }
  if (!parts.length) {
    return `Saldo geral ${formatMoneyBr(total)}.`;
  }
  return `Saldo geral ${formatMoneyBr(total)} — ${parts.join('; ')}.`;
};
