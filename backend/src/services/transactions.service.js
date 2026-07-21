import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import { resolveContaIdFromPayload } from './conta-financeira-default.js';

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

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

const resolveContaIdForUserPg = async (userId, contaPayload = {}) => {
  const { rows } = await query(
    `SELECT id, nome, tipo, ativo, criado_em
     FROM public.contas_financeiras
     WHERE user_id = $1 AND ativo = true
     ORDER BY criado_em ASC`,
    [userId],
  );
  return resolveContaIdFromPayload(rows || [], contaPayload);
};

const resolveContaIdForUser = async (dbClient, userId, contaPayload = {}) => {
  if (isLocalAuthMode()) {
    return resolveContaIdForUserPg(userId, contaPayload);
  }
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

const buildContaPayload = (payload = {}) => ({
  conta_id: payload?.conta_id ?? payload?.contaId ?? null,
  conta: payload?.conta,
  conta_nome: payload?.conta_nome,
  contaNome: payload?.contaNome,
  carteira: payload?.carteira,
  wallet: payload?.wallet,
});

const buildTransactionRow = (userId, payload, tipoToUse, statusNormalizado, contaId) => {
  const row = {
    tipo: tipoToUse,
    valor: payload.valor,
    classificacao: payload.classificacao,
    data: payload.data,
    status: statusNormalizado,
    obs: payload.obs || null,
    user_id: userId,
  };
  if (contaId) row.conta_id = contaId;
  if (payload.categoria !== undefined) {
    row.categoria = payload.categoria != null ? String(payload.categoria) : null;
  }
  if (payload.recorrencia_id !== undefined) {
    row.recorrencia_id = payload.recorrencia_id || null;
  }
  if (payload.recorrencia_ano_mes !== undefined) {
    row.recorrencia_ano_mes = payload.recorrencia_ano_mes || null;
  }
  return row;
};

export const listTransactions = async (userId) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT * FROM public.lancamentos_id
       WHERE user_id = $1
       ORDER BY criado_em DESC NULLS LAST`,
      [userId],
    );
    return rows || [];
  }

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
  const {
    tipo,
    valor,
    classificacao,
    data,
    status,
    obs,
    conta_id: contaIdRaw,
    categoria,
    recorrencia_id: recorrenciaId,
    recorrencia_ano_mes: recorrenciaAnoMes,
  } = payload || {};
  const tipoNormalizado = normalizeTipo(tipo);

  if (!tipoNormalizado || !valor || !classificacao || !data) {
    throw badRequest('Campos obrigatórios: tipo, valor, classificacao, data');
  }

  const statusNormalizado = normalizeTransactionStatus(tipoNormalizado, status || 'recebido');
  const contaPayload = buildContaPayload({
    ...payload,
    conta_id: contaIdRaw,
  });

  if (isLocalAuthMode()) {
    const contaId = await resolveContaIdForUserPg(userId, contaPayload);
    const tryInsert = async (tipoToUse) => {
      const { rows } = await query(
        `INSERT INTO public.lancamentos_id
          (tipo, valor, classificacao, data, status, obs, user_id, conta_id, categoria, recorrencia_id, recorrencia_ano_mes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          tipoToUse,
          valor,
          classificacao,
          data,
          statusNormalizado,
          obs || null,
          userId,
          contaId || null,
          categoria != null ? String(categoria) : null,
          recorrenciaId || null,
          recorrenciaAnoMes || null,
        ],
      );
      return rows[0];
    };

    try {
      return await tryInsert(String(tipoNormalizado));
    } catch (err) {
      if (shouldRetryTipo(err?.message, String(tipo))) {
        return await tryInsert('saida');
      }
      throw badRequest(err?.message || 'Erro ao criar lançamento');
    }
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const contaId = await resolveContaIdForUser(dbClient, userId, contaPayload);

  const tryInsert = async (tipoToUse) => {
    const row = buildTransactionRow(
      userId,
      {
        valor,
        classificacao,
        data,
        obs,
        categoria,
        recorrencia_id: recorrenciaId,
        recorrencia_ano_mes: recorrenciaAnoMes,
      },
      tipoToUse,
      statusNormalizado,
      contaId,
    );
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

  const patch = {
    ...updates,
    ...(updates.tipo ? { tipo: normalizeTipo(updates.tipo) } : {}),
  };
  if (patch.status != null && (patch.tipo || updates.tipo)) {
    patch.status = normalizeTransactionStatus(
      patch.tipo || updates.tipo,
      patch.status,
    );
  }

  if (isLocalAuthMode()) {
    const { rows: existingRows } = await query(
      `SELECT * FROM public.lancamentos_id WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!existingRows[0]) throw badRequest('Transação não encontrada');

    const next = { ...existingRows[0], ...patch };
    if (patch.conta_id !== undefined || patch.conta !== undefined) {
      const contaId = await resolveContaIdForUserPg(userId, buildContaPayload(patch));
      if (contaId) next.conta_id = contaId;
    }

    const { rows } = await query(
      `UPDATE public.lancamentos_id SET
        tipo = $3,
        valor = $4,
        classificacao = $5,
        data = $6,
        status = $7,
        obs = $8,
        conta_id = $9,
        categoria = $10,
        recorrencia_id = $11,
        recorrencia_ano_mes = $12
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        userId,
        next.tipo,
        next.valor,
        next.classificacao,
        next.data,
        next.status,
        next.obs ?? null,
        next.conta_id ?? null,
        next.categoria ?? null,
        next.recorrencia_id ?? null,
        next.recorrencia_ano_mes ?? null,
      ],
    );
    if (!rows[0]) throw badRequest('Transação não encontrada');
    return rows[0];
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await dbClient
    .from('lancamentos_id')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const deleteTransaction = async (userId, body, queryParams) => {
  const idFromQuery = queryParams?.id ?? null;
  const idFromBody = body?.id ?? null;
  const id = idFromQuery || idFromBody;

  if (!id) throw badRequest('ID da transação é obrigatório');

  if (isLocalAuthMode()) {
    const { rowCount } = await query(
      `DELETE FROM public.lancamentos_id WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!rowCount) throw badRequest('Transação não encontrada');
    return;
  }

  const dbClient = createSupabaseClient({ useServiceRole: true });
  const { error } = await dbClient
    .from('lancamentos_id')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);
};
