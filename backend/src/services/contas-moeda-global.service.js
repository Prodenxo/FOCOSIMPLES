import { createSupabaseClient } from '../config/supabase.js';
import { badRequest, notFound } from '../utils/errors.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const parseValor = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const normalizeMoeda = (raw) => {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  return code;
};

const listContasMoedaGlobalPg = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM public.contas_moeda_global
     WHERE user_id = $1 AND ativo = true
     ORDER BY moeda ASC`,
    [userId],
  );
  return rows || [];
};

export const listContasMoedaGlobal = async (userId) => {
  if (isLocalAuthMode()) {
    return listContasMoedaGlobalPg(userId);
  }
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .select('*')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('moeda', { ascending: true });
  if (error) throw badRequest(error.message);
  return data || [];
};

const resolveRow = async (userId, id) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT * FROM public.contas_moeda_global WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId],
    );
    if (!rows?.[0]) throw notFound('Moeda não encontrada');
    return rows[0];
  }
  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Moeda não encontrada');
  return data;
};

export const createContaMoedaGlobal = async (userId, payload = {}) => {
  const moeda = normalizeMoeda(payload.moeda);
  if (!moeda) throw badRequest('Informe uma moeda válida (código ISO de 3 letras).');
  const valor = parseValor(payload.valor);
  if (valor == null || valor < 0) throw badRequest('Informe um valor válido (≥ 0).');
  const nomeRaw = payload.nome != null ? String(payload.nome).trim() : '';
  const nome = nomeRaw || null;

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `INSERT INTO public.contas_moeda_global (user_id, moeda, nome, valor, ativo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, moeda, nome, valor],
    );
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .insert([{ user_id: userId, moeda, nome, valor, ativo: true }])
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const updateContaMoedaGlobal = async (userId, id, payload = {}) => {
  await resolveRow(userId, id);
  const patch = { atualizado_em: new Date().toISOString() };

  if (payload.moeda != null) {
    const moeda = normalizeMoeda(payload.moeda);
    if (!moeda) throw badRequest('Moeda inválida.');
    patch.moeda = moeda;
  }
  if (payload.valor != null) {
    const valor = parseValor(payload.valor);
    if (valor == null || valor < 0) throw badRequest('Valor inválido.');
    patch.valor = valor;
  }
  if (payload.nome !== undefined) {
    const nomeRaw = payload.nome != null ? String(payload.nome).trim() : '';
    patch.nome = nomeRaw || null;
  }
  if (payload.ativo != null) patch.ativo = Boolean(payload.ativo);

  if (isLocalAuthMode()) {
    const keys = Object.keys(patch);
    const sets = keys.map((k, i) => `${k} = $${i + 3}`);
    const { rows } = await query(
      `UPDATE public.contas_moeda_global SET ${sets.join(', ')}
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId, ...keys.map((k) => patch[k])],
    );
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

export const deleteContaMoedaGlobal = async (userId, id) => {
  await resolveRow(userId, id);

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `DELETE FROM public.contas_moeda_global WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from('contas_moeda_global')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw badRequest(error.message);
  return data;
};
