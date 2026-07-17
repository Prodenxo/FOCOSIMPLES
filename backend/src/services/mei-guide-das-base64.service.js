import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const TABLE = 'DAS_mei';

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  const periodoDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  return {
    raw: digits,
    iso: periodoDate.toISOString()
  };
};

const getSupabase = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para persistência do DAS');
  }
  return createSupabaseClient({ useServiceRole: true });
};

export const upsertDasBase64 = async ({ userId, periodoApuracao, pdfBase64 }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para persistência do DAS');
  }
  if (!pdfBase64) {
    throw badRequest('Base64 do DAS não informado');
  }
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para persistência do DAS');
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      user_id: userId,
      periodo_apuracao: periodo.iso,
      DAS: pdfBase64
    }, { onConflict: 'user_id,periodo_apuracao' });
  if (error) {
    throw badRequest(error.message || 'Falha ao salvar DAS em base64');
  }
  return { userId, periodoApuracao: periodo.raw };
};

export const getDasBase64 = async ({ userId, periodoApuracao }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para consulta do DAS');
  }
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para consulta do DAS');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('DAS')
    .eq('user_id', userId)
    .eq('periodo_apuracao', periodo.iso)
    .maybeSingle();
  if (error) {
    throw badRequest(error.message || 'Falha ao consultar DAS em base64');
  }
  return data?.DAS || null;
};

/** Remove PDF armazenado (ex.: ficheiro de outra pessoa gravado por engano). */
export const deleteDasBase64 = async ({ userId, periodoApuracao }) => {
  if (!userId) throw badRequest('Usuário não informado');
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) throw badRequest('Período inválido');
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('periodo_apuracao', periodo.iso);
  if (error) throw badRequest(error.message || 'Falha ao remover DAS armazenado');
  return { deleted: true, periodoApuracao: periodo.raw };
};
