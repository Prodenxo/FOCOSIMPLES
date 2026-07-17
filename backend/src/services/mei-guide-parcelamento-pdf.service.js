import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const TABLE = 'parcelamento_pdfs';

const normalizeNumero = (value) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
};

const getSupabase = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para persistência de PDF de parcelamento');
  }
  return createSupabaseClient({ useServiceRole: true });
};

export const upsertParcelamentoPdf = async ({
  userId,
  contribuinteNumero,
  numeroParcelamento,
  modalidade,
  pdfBase64
}) => {
  if (!userId) {
    throw badRequest('Usuário não informado para persistência do PDF de parcelamento');
  }
  if (!pdfBase64) {
    throw badRequest('Base64 do PDF não informado');
  }
  const numero = normalizeNumero(numeroParcelamento);
  if (!numero) {
    throw badRequest('Número do parcelamento inválido');
  }
  const contribNumero = normalizeNumero(contribuinteNumero) || '';

  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        contribuinte_numero: contribNumero,
        numero_parcelamento: numero,
        modalidade: modalidade != null ? String(modalidade).trim() || null : null,
        pdf_base64: pdfBase64
      },
      { onConflict: 'user_id,numero_parcelamento' }
    );

  if (error) {
    throw badRequest(error.message || 'Falha ao salvar PDF de parcelamento');
  }
  return { userId, numeroParcelamento: numero };
};

export const getParcelamentoPdf = async ({ userId, numeroParcelamento }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para consulta do PDF de parcelamento');
  }
  const numero = normalizeNumero(numeroParcelamento);
  if (!numero) {
    throw badRequest('Número do parcelamento inválido');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('pdf_base64, modalidade, contribuinte_numero')
    .eq('user_id', userId)
    .eq('numero_parcelamento', numero)
    .maybeSingle();

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar PDF de parcelamento');
  }
  return data;
};
