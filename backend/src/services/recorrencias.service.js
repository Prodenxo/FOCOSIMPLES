import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';

const RECORRENCIAS_TABLE = 'recorrencias';

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

export const listRecorrencias = async (userId) => {
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

  const db = createSupabaseClient({ useServiceRole: true });
  const { error } = await db
    .from(RECORRENCIAS_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw badRequest(error.message);
};
