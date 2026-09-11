import { createSupabaseClient } from '../config/supabase.js';
import { query } from '../config/pg.js';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../utils/errors.js';

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const normalizeMoeda = (raw) => {
  const code = String(raw || '').trim().toUpperCase();
  if (code.length !== 3) throw badRequest('Informe uma moeda válida (3 letras, ex.: USD).');
  return code;
};

const parseValor = (raw) => {
  if (raw === null || raw === undefined || raw === '') throw badRequest('Informe o valor.');
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw badRequest('Valor inválido.');
  return n;
};

const toDbPayload = (input, { partial = false } = {}) => {
  const patch = { atualizado_em: new Date().toISOString() };
  if (input?.moeda != null || !partial) {
    patch.moeda = normalizeMoeda(input?.moeda);
  }
  if (input?.valor != null || !partial) {
    patch.valor = parseValor(input?.valor);
  }
  if (input?.nome !== undefined || !partial) {
    const n = input?.nome != null ? String(input.nome).trim() : '';
    patch.nome = n || null;
  }
  if (input?.ativo != null || !partial) {
    patch.ativo = input?.ativo !== false;
  }
  return patch;
};

export const listContasMoedaGlobal = async (userId, { activeOnly = true } = {}) => {
  if (isLocalAuthMode()) {
    const params = [userId];
    let sql = `SELECT * FROM public.contas_moeda_global WHERE user_id = $1`;
    if (activeOnly) sql += ' AND ativo = true';
    sql += ' ORDER BY moeda ASC';
    const { rows } = await query(sql, params);
    return rows || [];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  let q = db
    .from('contas_moeda_global')
    .select('*')
    .eq('user_id', userId)
    .order('moeda', { ascending: true });
  if (activeOnly) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) {
    if (/contas_moeda_global/i.test(error.message || '')) {
      throw badRequest(
        'Contas em moeda global indisponíveis: tabela contas_moeda_global não encontrada no banco.',
      );
    }
    throw badRequest(error.message);
  }
  return data || [];
};

const fetchContaById = async (userId, id) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT * FROM public.contas_moeda_global WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId],
    );
    return rows[0] || null;
  }
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  return data;
};

export const createContaMoedaGlobal = async (userId, input = {}) => {
  const payload = toDbPayload(input);
  payload.ativo = input?.ativo !== false;

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `INSERT INTO public.contas_moeda_global (user_id, moeda, nome, valor, ativo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, payload.moeda, payload.nome, payload.valor, payload.ativo],
    );
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .insert([{ user_id: userId, ...payload }])
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const updateContaMoedaGlobal = async (userId, id, input = {}) => {
  const existing = await fetchContaById(userId, id);
  if (!existing) throw notFound('Conta em moeda global não encontrada.');

  const patch = toDbPayload(input, { partial: true });
  const merged = {
    moeda: patch.moeda ?? existing.moeda,
    nome: patch.nome !== undefined ? patch.nome : existing.nome,
    valor: patch.valor ?? existing.valor,
    ativo: patch.ativo ?? existing.ativo,
    atualizado_em: patch.atualizado_em,
  };

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `UPDATE public.contas_moeda_global SET
        moeda = $3,
        nome = $4,
        valor = $5,
        ativo = $6,
        atualizado_em = $7
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, merged.moeda, merged.nome, merged.valor, merged.ativo, merged.atualizado_em],
    );
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .update(merged)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const deleteContaMoedaGlobal = async (userId, id) => {
  const existing = await fetchContaById(userId, id);
  if (!existing) throw notFound('Conta em moeda global não encontrada.');

  if (isLocalAuthMode()) {
    await query(
      `DELETE FROM public.contas_moeda_global WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return existing;
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { error } = await db
    .from('contas_moeda_global')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw badRequest(error.message);
  return existing;
};
