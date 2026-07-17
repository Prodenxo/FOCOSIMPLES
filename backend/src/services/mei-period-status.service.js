import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';

const DAS_TABLE = 'das_mensal_status';
const USER_COMPANY_TABLE = 'role_x_user_x_empresa';
const DEFAULT_SOURCE = 'consulta_serpro';

let supabaseClientFactory = () => createSupabaseClient({ useServiceRole: true });

const getSupabase = () => supabaseClientFactory();

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const normalizeDocumentoFiscal = (value) => {
  const digits = normalizeDigits(value);
  return digits.length === 14 ? digits : null;
};

export const normalizeCompetencia = (value) => {
  const text = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    return text;
  }
  const digits = normalizeDigits(text);
  if (digits.length !== 6) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return null;
  return `${year}-${month}`;
};

export const periodoApuracaoToCompetencia = (periodoApuracao) => {
  return normalizeCompetencia(periodoApuracao);
};

export const competenciaToPeriodoApuracao = (competencia) => {
  const normalized = normalizeCompetencia(competencia);
  if (!normalized) return null;
  return normalized.replace('-', '');
};

const resolveEmpresaId = async (supabase, userId) => {
  const { data: activeLink, error: activeError } = await supabase
    .from(USER_COMPANY_TABLE)
    .select('empresas_id')
    .eq('user_id', userId)
    .eq('status', true)
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw badRequest(activeError.message || 'Erro ao consultar vínculo de empresa do usuário');
  }
  if (activeLink?.empresas_id) return activeLink.empresas_id;

  const { data: fallbackLink, error: fallbackError } = await supabase
    .from(USER_COMPANY_TABLE)
    .select('empresas_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw badRequest(fallbackError.message || 'Erro ao consultar vínculo de empresa do usuário');
  }
  return fallbackLink?.empresas_id || null;
};

export const listPaidCompetencias = async ({ userId, competencias = [] } = {}) => {
  if (!userId) return [];
  const normalizedCompetencias = Array.from(
    new Set((competencias || []).map((item) => normalizeCompetencia(item)).filter(Boolean))
  );
  if (normalizedCompetencias.length === 0) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(DAS_TABLE)
    .select('competencia')
    .eq('user_id', userId)
    .eq('status', 'pago')
    .in('competencia', normalizedCompetencias);

  if (error) {
    throw badRequest(error.message || 'Erro ao consultar competências pagas');
  }

  return Array.from(
    new Set((data || []).map((row) => normalizeCompetencia(row.competencia)).filter(Boolean))
  );
};

/** Último status conhecido em `das_mensal_status` (fallback quando SERPRO está indisponível). */
export const getKnownCompetenciaPeriodStatus = async ({ userId, competencia } = {}) => {
  const normalizedCompetencia = normalizeCompetencia(competencia);
  if (!userId || !normalizedCompetencia) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(DAS_TABLE)
    .select('status')
    .eq('user_id', userId)
    .eq('competencia', normalizedCompetencia)
    .maybeSingle();

  if (error) {
    throw badRequest(error.message || 'Erro ao consultar status conhecido da competência');
  }
  const raw = String(data?.status || '').trim().toLowerCase();
  if (raw === 'pago') return 'pago';
  if (raw === 'pendente') return 'a_pagar';
  return null;
};

export const isCompetenciaPaid = async ({ userId, competencia } = {}) => {
  const normalizedCompetencia = normalizeCompetencia(competencia);
  if (!userId || !normalizedCompetencia) return false;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(DAS_TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('competencia', normalizedCompetencia)
    .eq('status', 'pago')
    .maybeSingle();

  if (error) {
    throw badRequest(error.message || 'Erro ao verificar competência paga');
  }
  return Boolean(data?.id);
};

/** Remove marcação local de pago (ex.: para buscar PDF de novo na Receita após apagar DAS_mei). */
export const clearCompetenciaPaidStatus = async ({ userId, competencia } = {}) => {
  const normalizedCompetencia = normalizeCompetencia(competencia);
  if (!userId || !normalizedCompetencia) return { cleared: false };

  const supabase = getSupabase();
  const { error } = await supabase
    .from(DAS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('competencia', normalizedCompetencia);

  if (error) {
    throw badRequest(error.message || 'Erro ao limpar status pago da competência');
  }
  return { cleared: true, competencia: normalizedCompetencia };
};

export const markCompetenciaAsPaid = async ({
  userId,
  competencia,
  documentoFiscal,
  source = DEFAULT_SOURCE
} = {}) => {
  const normalizedCompetencia = normalizeCompetencia(competencia);
  if (!userId || !normalizedCompetencia) return null;

  const supabase = getSupabase();
  const normalizedDoc = normalizeDocumentoFiscal(documentoFiscal);

  const { data: updatedRows, error: updateError } = await supabase
    .from(DAS_TABLE)
    .update({
      status: 'pago',
      documento_fiscal: normalizedDoc,
      source: source || DEFAULT_SOURCE,
      error_message: null
    })
    .eq('user_id', userId)
    .eq('competencia', normalizedCompetencia)
    .select('id, user_id, competencia, status');

  if (updateError) {
    throw badRequest(updateError.message || 'Erro ao atualizar competência paga');
  }
  if ((updatedRows || []).length > 0) {
    return updatedRows[0];
  }

  const empresaId = await resolveEmpresaId(supabase, userId);
  if (!empresaId) return null;

  const { data, error } = await supabase
    .from(DAS_TABLE)
    .upsert({
      user_id: userId,
      empresa_id: empresaId,
      competencia: normalizedCompetencia,
      documento_fiscal: normalizedDoc,
      status: 'pago',
      pdf_bucket: 'mei-das-pdfs',
      pdf_path: '',
      source: source || DEFAULT_SOURCE,
      error_message: null
    }, { onConflict: 'user_id,competencia' })
    .select('id, user_id, competencia, status')
    .maybeSingle();

  if (error) {
    throw badRequest(error.message || 'Erro ao persistir competência paga');
  }
  return data;
};

export const __setSupabaseClientFactoryForTests = (factory) => {
  supabaseClientFactory = typeof factory === 'function'
    ? factory
    : () => createSupabaseClient({ useServiceRole: true });
};
