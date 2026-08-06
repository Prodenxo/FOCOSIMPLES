import { createSupabaseClient } from '../config/supabase.js';
import {
  DEFAULT_BUSINESS_TYPE,
  parseBusinessTypeFromMirrorJson,
} from '../lib/empresa-business-type.js';

const TABLE = 'user_mei_certificates';

const defaultGetSupabase = () => createSupabaseClient({ useServiceRole: true });
/** @type {null | (() => import('@supabase/supabase-js').SupabaseClient)} */
let getSupabaseOverride = null;

/** @internal testes */
export const __setGetSupabaseForTests = (fn) => {
  getSupabaseOverride = typeof fn === 'function' ? fn : null;
};

export const __resetGetSupabaseForTests = () => {
  getSupabaseOverride = null;
};

const getSupabase = () => (getSupabaseOverride ? getSupabaseOverride() : defaultGetSupabase());

/**
 * Lê business_type do espelho jsonb documentos_ativos (default RESELLER).
 * @param {string|undefined} userId
 */
export const getBusinessTypeMirror = async (userId) => {
  if (!userId) return DEFAULT_BUSINESS_TYPE;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select('documentos_ativos')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return DEFAULT_BUSINESS_TYPE;
    return parseBusinessTypeFromMirrorJson(data.documentos_ativos);
  } catch {
    return DEFAULT_BUSINESS_TYPE;
  }
};

/**
 * Persiste business_type no jsonb documentos_ativos (merge com flags existentes).
 * @param {string|undefined} userId
 * @param {string} businessType
 */
export const persistBusinessTypeMirror = async (userId, businessType) => {
  if (!userId) return;
  const normalized = businessType === 'MANUFACTURER' ? 'MANUFACTURER' : 'RESELLER';
  try {
    const supabase = getSupabase();
    const { data: existing, error: selErr } = await supabase
      .from(TABLE)
      .select('id, documentos_ativos')
      .eq('user_id', userId)
      .maybeSingle();
    if (selErr || !existing?.id) return;

    const prev = existing.documentos_ativos && typeof existing.documentos_ativos === 'object'
      && !Array.isArray(existing.documentos_ativos)
      ? { ...existing.documentos_ativos }
      : {};

    const json = {
      nfse: Boolean(prev.nfse),
      nfe: Boolean(prev.nfe),
      nfce: Boolean(prev.nfce),
      business_type: normalized,
    };

    await supabase
      .from(TABLE)
      .update({ documentos_ativos: json, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch {
    // espelho best-effort — não bloqueia cadastro fiscal
  }
};
