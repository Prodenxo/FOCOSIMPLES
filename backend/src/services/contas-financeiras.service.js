import { createSupabaseClient } from '../config/supabase.js';
import { badRequest, notFound } from '../utils/errors.js';
import {
  DEFAULT_CONTA_NOME,
  matchContaByName,
  pickDefaultContaFinanceira,
  resolveContaIdFromPayload,
  resolveExplicitContaFromPayload,
} from './conta-financeira-default.js';
import { computeContaSaldoAtual, computeUnassignedSaldoDelta, formatGetSaldoMessage } from './conta-financeira-saldo.js';

const CONTA_TIPOS = new Set(['corrente', 'poupanca', 'cartao_credito', 'dinheiro', 'outro']);

const parseMoney = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/[R$r$]/gi, '').replace(/\s/g, '');
  if (!s) return null;
  if (/^\d+([.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const br = s.replace(/\./g, '').replace(',', '.');
  const n = Number(br);
  return Number.isFinite(n) ? n : null;
};

export const listContasFinanceiras = async (userId, { activeOnly = true } = {}) => {
  const db = createSupabaseClient({ useServiceRole: true });
  let q = db
    .from('contas_financeiras')
    .select('*')
    .eq('user_id', userId)
    .order('criado_em', { ascending: true });
  if (activeOnly) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw badRequest(error.message);
  return data || [];
};

const fetchLancamentosForSaldo = async (userId) => {
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('lancamentos_id')
    .select('id, conta_id, tipo, valor, status')
    .eq('user_id', userId);
  if (error) throw badRequest(error.message);
  return data || [];
};

export const listContasWithSaldo = async (userId) => {
  const [contas, lancamentos] = await Promise.all([
    listContasFinanceiras(userId, { activeOnly: true }),
    fetchLancamentosForSaldo(userId),
  ]);
  const defaultConta = pickDefaultContaFinanceira(contas);
  const rows = contas.map((c) => {
    const saldoAtual = computeContaSaldoAtual(c.saldo_inicial, lancamentos, c.id);
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldoInicial: Number(c.saldo_inicial) || 0,
      saldoAtual,
      isDefault: defaultConta?.id === c.id,
      ativo: c.ativo !== false,
    };
  });
  const totalSaldoContas = rows.reduce((sum, r) => sum + r.saldoAtual, 0);
  const saldoSemConta = computeUnassignedSaldoDelta(lancamentos);
  return {
    contas: rows,
    totalSaldo: totalSaldoContas + saldoSemConta,
    totalSaldoContas,
    saldoSemConta,
    defaultContaId: defaultConta?.id ?? null,
    defaultContaNome: defaultConta?.nome ?? null,
  };
};

export const getSaldoResumo = async (userId, payload = {}) => {
  const summary = await listContasWithSaldo(userId);
  const contasForMatch = summary.contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    ativo: true,
  }));
  const matched = resolveExplicitContaFromPayload(contasForMatch, payload);
  if (matched?.id) {
    const one = summary.contas.find((c) => String(c.id) === String(matched.id));
    if (!one) throw notFound('Carteira não encontrada');
    return {
      carteira: one,
      totalSaldo: one.saldoAtual,
      contas: [one],
      filtered: true,
      defaultContaId: summary.defaultContaId,
      defaultContaNome: summary.defaultContaNome,
    };
  }
  return { ...summary, filtered: false };
};

export { formatGetSaldoMessage };

const resolveContaRow = async (userId, payload = {}) => {
  const contas = await listContasFinanceiras(userId, { activeOnly: false });
  const id = resolveContaIdFromPayload(contas, payload);
  if (!id) {
    throw badRequest('Informe conta_id (UUID) ou carteira/conta com o nome exacto. Use list_contas.');
  }
  const row = contas.find((c) => String(c.id) === String(id));
  if (!row) throw notFound('Carteira não encontrada');
  return row;
};

export const createContaFinanceira = async (userId, payload = {}) => {
  const nome = String(payload?.nome ?? payload?.carteira ?? payload?.conta ?? '').trim()
    || DEFAULT_CONTA_NOME;
  const tipoRaw = String(payload?.tipo ?? 'dinheiro').trim().toLowerCase();
  const tipo = CONTA_TIPOS.has(tipoRaw) ? tipoRaw : 'dinheiro';
  const saldoInicial = parseMoney(payload?.saldo_inicial ?? payload?.saldoInicial ?? payload?.saldo) ?? 0;

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_financeiras')
    .insert([
      {
        user_id: userId,
        nome,
        tipo,
        saldo_inicial: saldoInicial,
        limite_credito: parseMoney(payload?.limite_credito ?? payload?.limiteCredito),
        cor: payload?.cor ? String(payload.cor) : null,
        instituicao_id: payload?.instituicao_id ? String(payload.instituicao_id) : null,
        ativo: true,
      },
    ])
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const updateContaFinanceira = async (userId, payload = {}) => {
  const row = await resolveContaRow(userId, payload);
  const patch = { atualizado_em: new Date().toISOString() };

  if (payload?.nome != null || payload?.carteira != null || payload?.conta != null) {
    patch.nome = String(payload.nome ?? payload.carteira ?? payload.conta).trim();
    if (!patch.nome) throw badRequest('nome da carteira não pode ser vazio');
  }
  if (payload?.tipo != null) {
    const tipo = String(payload.tipo).trim().toLowerCase();
    if (!CONTA_TIPOS.has(tipo)) throw badRequest('tipo inválido');
    patch.tipo = tipo;
  }
  if (payload?.saldo_inicial != null || payload?.saldoInicial != null || payload?.saldo != null) {
    const saldo = parseMoney(payload.saldo_inicial ?? payload.saldoInicial ?? payload.saldo);
    if (saldo == null) throw badRequest('saldo_inicial inválido');
    patch.saldo_inicial = saldo;
  }
  if (payload?.ativo != null) patch.ativo = Boolean(payload.ativo);
  if (payload?.cor != null) patch.cor = payload.cor ? String(payload.cor) : null;
  if (payload?.limite_credito != null || payload?.limiteCredito != null) {
    patch.limite_credito = parseMoney(payload.limite_credito ?? payload.limiteCredito);
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_financeiras')
    .update(patch)
    .eq('id', row.id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

/** Desactiva carteira (ativo=false). Lançamentos mantêm conta_id histórico. */
export const deleteContaFinanceira = async (userId, payload = {}) => {
  const row = await resolveContaRow(userId, payload);
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_financeiras')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', row.id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};
