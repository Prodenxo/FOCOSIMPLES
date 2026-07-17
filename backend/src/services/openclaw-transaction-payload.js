import { badRequest } from '../utils/errors.js';
import {
  extractCarteiraHintFromText,
  getWalletNameFromPayload,
  matchContaByName,
  matchContaByTipoHint,
  pickDefaultContaFinanceira,
  resolveExplicitContaFromPayload,
} from './conta-financeira-default.js';

/**
 * UUID do lançamento no payload do bot (aceita aliases comuns do modelo).
 * @param {object | undefined} payload
 * @returns {string | null}
 */
export const resolveOpenclawTransactionId = (payload) => {
  const raw =
    payload?.id ??
    payload?.transactionId ??
    payload?.transaction_id ??
    payload?.lancamentoId ??
    payload?.lancamento_id;
  const id = raw != null ? String(raw).trim() : '';
  return id || null;
};

const TIPO_ALIASES = {
  entrada: 'entrada',
  ingresso: 'entrada',
  receita: 'entrada',
  recebimento: 'entrada',
  recebi: 'entrada',
  credito: 'entrada',
  crédito: 'entrada',
  saida: 'saida',
  saída: 'saida',
  despesa: 'saida',
  gasto: 'saida',
  pagamento: 'saida',
  debito: 'saida',
  débito: 'saida',
};

const normalizeCategoryKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const parseValor = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+([.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const br = s
    .replace(/[R$r$]/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(br);
  return Number.isFinite(n) ? n : null;
};

const resolveDataIso = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'hoje' || s === 'today' || s === 'agora') {
    return new Date().toISOString().slice(0, 10);
  }
  if (s === 'ontem' || s === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
};

const isNumericCategoryCode = (value) => /^\d{3,8}$/.test(String(value || '').trim());

const hasExplicitWalletIdInPayload = (payload = {}) => {
  const raw = payload?.conta_id ?? payload?.contaId ?? payload?.conta_uuid ?? null;
  return raw != null && String(raw).trim() !== '';
};

const hasExplicitWalletChoiceInPayload = (payload = {}, requestedName = '') => (
  hasExplicitWalletIdInPayload(payload)
  || Boolean(getWalletNameFromPayload(payload))
  || Boolean(requestedName)
);

/**
 * Lançamentos via WhatsApp costumam ser realizados (já pagou/recebeu).
 * "pendente" no modelo não contabiliza no dashboard — usar pago/recebido.
 */
const resolveOpenclawCreateStatus = (tipo, rawStatus) => {
  const raw = String(rawStatus ?? '').trim().toLowerCase();
  if (raw === 'a_pagar' || raw === 'a_receber') return raw;
  if (tipo === 'entrada') {
    if (!raw || raw === 'pendente' || raw === 'pago') return 'recebido';
    return raw;
  }
  if (!raw || raw === 'pendente' || raw === 'recebido') return 'pago';
  return raw;
};

/**
 * Resolve carteira para create_transaction (sem fallback silencioso quando o nome foi pedido).
 * @param {Array<{ id?: string, nome?: string, tipo?: string, ativo?: boolean }>} contas
 * @param {object} payload
 */
const resolveContaForOpenclawTransaction = (contas = [], payload = {}) => {
  const activeContas = contas.filter((c) => c?.ativo !== false);
  let requestedName = getWalletNameFromPayload(payload);
  if (!requestedName) {
    const hintText = [
      payload?.obs,
      payload?.observacao,
      payload?.description,
      payload?.descricao,
    ]
      .filter(Boolean)
      .join(' ');
    requestedName = extractCarteiraHintFromText(hintText);
  }

  let conta = resolveExplicitContaFromPayload(contas, payload);
  if (!conta && requestedName && !getWalletNameFromPayload(payload)) {
    conta =
      matchContaByName(contas, requestedName)
      ?? matchContaByTipoHint(contas, requestedName);
  }

  if (hasExplicitWalletIdInPayload(payload) && !conta) {
    throw badRequest(
      'conta_id inválido ou carteira inactiva. Chame list_contas e use um id válido.',
      { code: 'CARTEIRA_INVALIDA' },
    );
  }

  if (getWalletNameFromPayload(payload) && contas.length && !conta) {
    throw badRequest(
      `Carteira/conta "${getWalletNameFromPayload(payload)}" não encontrada. `
      + 'Chame list_contas e use o nome exacto, tipo (poupança/corrente) ou conta_id (UUID).',
      { code: 'CARTEIRA_NAO_ENCONTRADA' },
    );
  }

  if (requestedName && contas.length && !conta) {
    throw badRequest(
      `Carteira "${requestedName}" não encontrada no texto do pedido. `
      + 'Chame list_contas e repita com o campo carteira no payload.',
      { code: 'CARTEIRA_NAO_ENCONTRADA' },
    );
  }

  if (!conta && activeContas.length > 1 && !hasExplicitWalletChoiceInPayload(payload, requestedName)) {
    throw badRequest(
      'Várias carteiras activas e o pedido não indicou qual usar. '
      + 'Chame list_contas, mostre a lista numerada e peça ao utilizador antes de create_transaction.',
      {
        code: 'CARTEIRA_ESCOLHA_OBRIGATORIA',
        botHint:
          'Pergunte em qual carteira lançar (ex.: Banco do Brasil, Nubank, Poupança). '
          + 'Não assuma a carteira padrão quando há mais de uma.',
        contas: activeContas.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
      },
    );
  }

  if (!conta) {
    conta = pickDefaultContaFinanceira(contas);
  }

  return {
    conta_id: conta?.id ?? null,
    conta_nome: conta?.nome ?? null,
    requestedName: requestedName || null,
  };
};

/**
 * Corrige payload do OpenClaw antes de createTransaction.
 * @param {object} payload
 * @param {{ categories?: Array<{ nome?: string, tipo?: string }> }} [options]
 */
export const normalizeOpenclawTransactionPayload = (payload = {}, options = {}) => {
  const categories = options.categories || [];
  const tipoRaw = String(payload?.tipo ?? payload?.type ?? '').trim().toLowerCase();
  const tipo = TIPO_ALIASES[tipoRaw] || (tipoRaw === 'saída' ? 'saida' : tipoRaw);

  let classificacao = String(
    payload?.classificacao
    ?? payload?.categoria
    ?? payload?.category
    ?? payload?.descricao
    ?? payload?.description
    ?? '',
  ).trim();

  if (isNumericCategoryCode(classificacao)) {
    classificacao = '';
  }

  if (classificacao && categories.length) {
    const key = normalizeCategoryKey(classificacao);
    const match = categories.find((c) => normalizeCategoryKey(c?.nome) === key);
    if (match?.nome) classificacao = match.nome;
    else {
      const partial = categories.find(
        (c) =>
          normalizeCategoryKey(c?.nome).includes(key)
          || key.includes(normalizeCategoryKey(c?.nome)),
      );
      if (partial?.nome) classificacao = partial.nome;
    }
  }

  if (!classificacao) {
    const salarioHints = ['salario', 'salário', 'salary'];
    const hint = salarioHints.find((h) => tipo === 'entrada');
    if (hint && categories.length) {
      const sal = categories.find(
        (c) =>
          c?.tipo === 'entrada'
          && normalizeCategoryKey(c?.nome).includes('salario'),
      );
      if (sal?.nome) classificacao = sal.nome;
    }
  }

  const valor = parseValor(payload?.valor ?? payload?.value ?? payload?.amount);
  const data = resolveDataIso(payload?.data ?? payload?.date);

  const missing = [];
  if (!tipo || (tipo !== 'entrada' && tipo !== 'saida')) {
    missing.push('tipo (use entrada ou saida — não use "ingresso")');
  }
  if (valor == null || valor <= 0) missing.push('valor (número, ex.: 2500)');
  if (!classificacao) {
    missing.push(
      'classificacao (nome da categoria na app, ex.: Salário — nunca código numérico inventado)',
    );
  }
  if (!data) missing.push('data (YYYY-MM-DD ou "hoje")');

  if (missing.length) {
    throw badRequest(
      `Lançamento incompleto para a API: ${missing.join('; ')}. `
      + 'Chame list_categories e use o campo nome exato da categoria.',
    );
  }

  const contas = options.contas || [];
  const { conta_id, conta_nome } = resolveContaForOpenclawTransaction(contas, payload);

  return {
    tipo,
    valor,
    classificacao,
    data,
    status: resolveOpenclawCreateStatus(tipo, payload?.status),
    obs: payload?.obs ?? payload?.observacao ?? null,
    conta_id,
    conta_nome,
  };
};

/** Campos parciais para update_transaction (OpenClaw). */
export const normalizeOpenclawTransactionUpdate = (payload = {}, options = {}) => {
  const id = resolveOpenclawTransactionId(payload);
  if (!id) {
    throw badRequest('ID da transação é obrigatório (payload.id ou transactionId)');
  }

  const patch = { id };
  const categories = options.categories || [];
  const contas = options.contas || [];

  if (payload?.tipo != null || payload?.type != null) {
    const tipoRaw = String(payload?.tipo ?? payload?.type ?? '').trim().toLowerCase();
    const tipo = TIPO_ALIASES[tipoRaw] || (tipoRaw === 'saída' ? 'saida' : tipoRaw);
    if (tipo !== 'entrada' && tipo !== 'saida') {
      throw badRequest('tipo inválido (entrada ou saida)');
    }
    patch.tipo = tipo;
  }

  if (payload?.valor != null || payload?.value != null || payload?.amount != null) {
    const valor = parseValor(payload?.valor ?? payload?.value ?? payload?.amount);
    if (valor == null || valor <= 0) throw badRequest('valor inválido');
    patch.valor = valor;
  }

  if (
    payload?.classificacao != null
    || payload?.categoria != null
    || payload?.category != null
  ) {
    let classificacao = String(
      payload?.classificacao ?? payload?.categoria ?? payload?.category ?? '',
    ).trim();
    if (isNumericCategoryCode(classificacao)) classificacao = '';
    if (!classificacao) throw badRequest('classificacao inválida');
    if (categories.length) {
      const key = normalizeCategoryKey(classificacao);
      const match = categories.find((c) => normalizeCategoryKey(c?.nome) === key);
      if (match?.nome) classificacao = match.nome;
    }
    patch.classificacao = classificacao;
  }

  if (payload?.data != null || payload?.date != null) {
    const data = resolveDataIso(payload?.data ?? payload?.date);
    if (!data) throw badRequest('data inválida');
    patch.data = data;
  }

  if (payload?.status != null) patch.status = payload.status;
  if (payload?.obs != null || payload?.observacao != null) {
    patch.obs = payload?.obs ?? payload?.observacao ?? null;
  }

  const hasCarteiraField =
    hasExplicitWalletIdInPayload(payload)
    || getWalletNameFromPayload(payload) !== '';
  if (hasCarteiraField && contas.length) {
    const conta = resolveExplicitContaFromPayload(contas, payload);
    const requestedName = getWalletNameFromPayload(payload);
    if (hasExplicitWalletIdInPayload(payload) && !conta) {
      throw badRequest('conta_id inválido. Use list_contas.', { code: 'CARTEIRA_INVALIDA' });
    }
    if (requestedName && !conta) {
      throw badRequest(
        `Carteira "${requestedName}" não encontrada. Use list_contas.`,
        { code: 'CARTEIRA_NAO_ENCONTRADA' },
      );
    }
    if (conta?.id) patch.conta_id = conta.id;
  }

  if (Object.keys(patch).length === 1) {
    throw badRequest('Nenhum campo para actualizar além do id');
  }

  return patch;
};
