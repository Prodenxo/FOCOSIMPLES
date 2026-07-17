import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import { resolveContaIdFromPayload } from './conta-financeira-default.js';

const normalizeTipo = (tipo) => {
  if (!tipo) return tipo;
  return tipo === 'saída' ? 'saida' : tipo;
};

/** Entrada realizada → recebido; saída realizada → pago (alinha app + saldo geral). */
export const normalizeTransactionStatus = (tipo, status) => {
  const tipoNorm = normalizeTipo(tipo);
  const raw = String(status || '').trim().toLowerCase();
  if (tipoNorm === 'entrada') {
    if (raw === 'a_receber' || raw === 'pendente') return raw;
    if (!raw || raw === 'pago' || raw === 'recebido') return 'recebido';
    return raw;
  }
  if (raw === 'a_pagar' || raw === 'pendente') return raw;
  if (!raw || raw === 'recebido') return 'pago';
  return raw || 'pago';
};

export { listContasFinanceiras as listActiveContasFinanceiras } from './contas-financeiras.service.js';

const resolveContaIdForUser = async (dbClient, userId, contaPayload = {}) => {
  const { data, error } = await dbClient
    .from('contas_financeiras')
    .select('id, nome, tipo, ativo, criado_em')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('criado_em', { ascending: true });
  if (error) throw badRequest(error.message);
  return resolveContaIdFromPayload(data || [], contaPayload);
};

const shouldRetryTipo = (errorMessage, tipoValue) => {
  if (tipoValue !== 'saída') return false;
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('invalid input value for enum') ||
    msg.includes('check constraint') ||
    msg.includes('violates check constraint');
};

export const listTransactions = async (userId) => {
  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from('lancamentos_id')
    .select('*')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false });

  if (error) throw badRequest(error.message);
  return data || [];
};

export const createTransaction = async (userId, payload) => {
  const { tipo, valor, classificacao, data, status, obs, conta_id: contaIdRaw } = payload || {};
  const tipoNormalizado = normalizeTipo(tipo);

  if (!tipoNormalizado || !valor || !classificacao || !data) {
    throw badRequest('Campos obrigatórios: tipo, valor, classificacao, data');
  }

  const statusNormalizado = normalizeTransactionStatus(tipoNormalizado, status || 'recebido');
  const dbClient = createSupabaseClient({ useServiceRole: true });
  const contaId = await resolveContaIdForUser(dbClient, userId, {
    conta_id: contaIdRaw,
    conta: payload?.conta,
    conta_nome: payload?.conta_nome,
    contaNome: payload?.contaNome,
    carteira: payload?.carteira,
    wallet: payload?.wallet,
  });

  const tryInsert = async (tipoToUse) => {
    const row = {
      tipo: tipoToUse,
      valor,
      classificacao,
      data,
      status: statusNormalizado,
      obs: obs || null,
      user_id: userId,
    };
    if (contaId) row.conta_id = contaId;
    return await dbClient
      .from('lancamentos_id')
      .insert([row])
      .select()
      .single();
  };

  let { data: newTransaction, error } = await tryInsert(String(tipoNormalizado));
  if (error && shouldRetryTipo(error.message, String(tipo))) {
    const retry = await tryInsert('saida');
    newTransaction = retry.data;
    error = retry.error;
  }

  if (error) throw badRequest(error.message);
  return newTransaction;
};

export const updateTransaction = async (userId, payload) => {
  const { id, ...updates } = payload || {};
  if (!id) throw badRequest('ID da transação é obrigatório');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from('lancamentos_id')
    .update({
      ...updates,
      ...(updates.tipo ? { tipo: normalizeTipo(updates.tipo) } : {})
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const deleteTransaction = async (userId, body, query) => {
  const idFromQuery = query?.id ?? null;
  const idFromBody = body?.id ?? null;
  const id = idFromQuery || idFromBody;

  if (!id) throw badRequest('ID da transação é obrigatório');

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { error } = await dbClient
    .from('lancamentos_id')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);
};
