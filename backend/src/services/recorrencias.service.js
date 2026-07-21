import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import { env } from '../config/env.js';
import { query } from '../config/pg.js';

const RECORRENCIAS_TABLE = 'recorrencias';
const SKIPS_TABLE = 'recorrencia_skips';
const isLocalAuthMode = () => env.AUTH_MODE === 'local';

const normalizeTipo = (tipo) => {
  if (!tipo) return tipo;
  return tipo === 'saída' ? 'saida' : tipo;
};

const shouldRetryTipo = (errorMessage, tipoValue) => {
  if (tipoValue !== 'saída') return false;
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('invalid input value for enum') ||
    msg.includes('check constraint') ||
    msg.includes('violates check constraint');
};

const isFkViolation = (errorMessage, code) => {
  if (code === '23503') return true;
  return /foreign key|violates foreign key|constraint/i.test(String(errorMessage || ''));
};

const validateDiaDoMes = (dia) => {
  const n = Number(dia);
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw badRequest('dia_do_mes deve ser um número entre 1 e 31');
  }
  return n;
};

const validateMaxOcorrencias = (max) => {
  if (max === null || max === undefined || max === '') return null;
  const n = Number(max);
  if (!Number.isInteger(n) || n < 1 || n > 1200) {
    throw badRequest('max_ocorrencias deve ser um inteiro entre 1 e 1200, ou nulo');
  }
  return n;
};

const validateAnoMes = (anoMes) => {
  const s = String(anoMes || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    throw badRequest('ano_mes deve estar no formato YYYY-MM');
  }
  return s;
};

export const listRecorrencias = async (userId) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT * FROM public.recorrencias
       WHERE user_id = $1
       ORDER BY dia_do_mes ASC, classificacao ASC`,
      [userId],
    );
    return rows || [];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(RECORRENCIAS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('dia_do_mes', { ascending: true })
    .order('classificacao', { ascending: true });

  if (error) throw badRequest(error.message);
  return data || [];
};

export const createRecorrencia = async (userId, payload) => {
  const { dia_do_mes, valor, classificacao, tipo, status, obs, categoria, ativo, max_ocorrencias } = payload || {};
  const tipoNorm = normalizeTipo(tipo);

  if (!tipoNorm || valor == null || valor === '' || !classificacao?.trim()) {
    throw badRequest('Campos obrigatórios: tipo, valor, classificacao');
  }

  const dia = validateDiaDoMes(dia_do_mes);
  const maxOco = validateMaxOcorrencias(max_ocorrencias);

  if (isLocalAuthMode()) {
    const tryInsert = async (tipoToUse) => {
      const { rows } = await query(
        `INSERT INTO public.recorrencias
          (user_id, dia_do_mes, valor, classificacao, tipo, status, obs, categoria, ativo, max_ocorrencias, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         RETURNING *`,
        [
          userId,
          dia,
          Number(valor),
          String(classificacao).trim(),
          String(tipoToUse),
          status || 'pago',
          obs != null ? String(obs) : null,
          categoria != null ? String(categoria) : null,
          ativo !== false,
          maxOco,
        ],
      );
      return rows[0];
    };

    try {
      return await tryInsert(String(tipoNorm));
    } catch (err) {
      if (shouldRetryTipo(err?.message, String(tipo))) {
        return await tryInsert('saida');
      }
      throw badRequest(err?.message || 'Erro ao criar recorrência');
    }
  }

  const db = createSupabaseClient({ useServiceRole: true });

  const row = {
    user_id: userId,
    dia_do_mes: dia,
    valor: Number(valor),
    classificacao: String(classificacao).trim(),
    tipo: String(tipoNorm),
    status: status || 'pago',
    obs: obs != null ? String(obs) : null,
    categoria: categoria != null ? String(categoria) : null,
    ativo: ativo !== false,
    max_ocorrencias: maxOco,
    atualizado_em: new Date().toISOString()
  };

  const tryInsert = async (tipoToUse) => {
    return await db
      .from(RECORRENCIAS_TABLE)
      .insert([{ ...row, tipo: tipoToUse }])
      .select()
      .single();
  };

  let { data: created, error } = await tryInsert(String(tipoNorm));
  if (error && shouldRetryTipo(error.message, String(tipo))) {
    const retry = await tryInsert('saida');
    created = retry.data;
    error = retry.error;
  }

  if (error) throw badRequest(error.message);
  return created;
};

export const updateRecorrencia = async (userId, id, payload) => {
  if (!id) throw badRequest('ID da recorrência é obrigatório');

  const { dia_do_mes, valor, classificacao, tipo, status, obs, categoria, ativo, max_ocorrencias } = payload || {};
  const updates = { atualizado_em: new Date().toISOString() };

  if (dia_do_mes !== undefined) updates.dia_do_mes = validateDiaDoMes(dia_do_mes);
  if (valor !== undefined) updates.valor = Number(valor);
  if (classificacao !== undefined) updates.classificacao = String(classificacao).trim();
  if (tipo !== undefined) updates.tipo = normalizeTipo(tipo) || updates.tipo;
  if (status !== undefined) updates.status = status;
  if (obs !== undefined) updates.obs = obs;
  if (categoria !== undefined) updates.categoria = categoria;
  if (ativo !== undefined) updates.ativo = ativo !== false;
  if (max_ocorrencias !== undefined) updates.max_ocorrencias = validateMaxOcorrencias(max_ocorrencias);

  if (isLocalAuthMode()) {
    const { rows } = await query(
      `UPDATE public.recorrencias SET
        dia_do_mes = COALESCE($3, dia_do_mes),
        valor = COALESCE($4, valor),
        classificacao = COALESCE($5, classificacao),
        tipo = COALESCE($6, tipo),
        status = COALESCE($7, status),
        obs = CASE WHEN $8::boolean THEN $9 ELSE obs END,
        categoria = CASE WHEN $10::boolean THEN $11 ELSE categoria END,
        ativo = COALESCE($12, ativo),
        max_ocorrencias = CASE WHEN $13::boolean THEN $14 ELSE max_ocorrencias END,
        atualizado_em = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        userId,
        updates.dia_do_mes ?? null,
        updates.valor ?? null,
        updates.classificacao ?? null,
        updates.tipo ?? null,
        updates.status ?? null,
        Object.prototype.hasOwnProperty.call(updates, 'obs'),
        updates.obs ?? null,
        Object.prototype.hasOwnProperty.call(updates, 'categoria'),
        updates.categoria ?? null,
        updates.ativo ?? null,
        Object.prototype.hasOwnProperty.call(updates, 'max_ocorrencias'),
        updates.max_ocorrencias ?? null,
      ],
    );
    if (!rows[0]) throw badRequest('Recorrência não encontrada');
    return rows[0];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(RECORRENCIAS_TABLE)
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw badRequest(error.message);
  return data;
};

export const deleteRecorrencia = async (userId, id) => {
  if (!id) throw badRequest('ID da recorrência é obrigatório');

  if (isLocalAuthMode()) {
    try {
      const result = await query(
        `DELETE FROM public.recorrencias WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId],
      );
      if (!result.rows[0]) throw badRequest('Recorrência não encontrada');
      return { mode: 'hard' };
    } catch (err) {
      if (!isFkViolation(err?.message, err?.code)) {
        if (err instanceof Error && 'status' in err) throw err;
        throw badRequest(err?.message || 'Erro ao excluir recorrência');
      }
      const { rows } = await query(
        `UPDATE public.recorrencias
         SET ativo = false, atualizado_em = now()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId],
      );
      if (!rows[0]) throw badRequest('Recorrência não encontrada');
      return { mode: 'soft' };
    }
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { error } = await db
    .from(RECORRENCIAS_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    if (!isFkViolation(error.message, error.code)) throw badRequest(error.message);
    const { data, error: updErr } = await db
      .from(RECORRENCIAS_TABLE)
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (updErr) throw badRequest(updErr.message);
    return { mode: 'soft', data };
  }
  return { mode: 'hard' };
};

export const listRecorrenciaSkips = async (userId) => {
  if (isLocalAuthMode()) {
    const { rows } = await query(
      `SELECT recorrencia_id, ano_mes
       FROM public.recorrencia_skips
       WHERE user_id = $1
       ORDER BY ano_mes ASC`,
      [userId],
    );
    return rows || [];
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(SKIPS_TABLE)
    .select('recorrencia_id, ano_mes')
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);
  return data || [];
};

export const addRecorrenciaSkip = async (userId, payload = {}) => {
  const recorrenciaId = payload.recorrencia_id || payload.recorrenciaId;
  const anoMes = validateAnoMes(payload.ano_mes || payload.anoMes);
  if (!recorrenciaId) throw badRequest('recorrencia_id é obrigatório');

  if (isLocalAuthMode()) {
    const { rows: owned } = await query(
      `SELECT id FROM public.recorrencias WHERE id = $1 AND user_id = $2`,
      [recorrenciaId, userId],
    );
    if (!owned[0]) throw badRequest('Recorrência não encontrada');

    const { rows } = await query(
      `INSERT INTO public.recorrencia_skips (user_id, recorrencia_id, ano_mes)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM public.recorrencia_skips
         WHERE user_id = $1 AND recorrencia_id = $2 AND ano_mes = $3
       )
       RETURNING recorrencia_id, ano_mes`,
      [userId, recorrenciaId, anoMes],
    );
    if (rows[0]) return rows[0];
    return { recorrencia_id: recorrenciaId, ano_mes: anoMes };
  }

  const db = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await db
    .from(SKIPS_TABLE)
    .insert([{ user_id: userId, recorrencia_id: recorrenciaId, ano_mes: anoMes }])
    .select('recorrencia_id, ano_mes')
    .maybeSingle();

  if (error && error.code !== '23505') throw badRequest(error.message);
  return data || { recorrencia_id: recorrenciaId, ano_mes: anoMes };
};
