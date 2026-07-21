import { createSupabaseClient } from '../config/supabase.js'
import { env } from '../config/env.js'
import { badRequest } from '../utils/errors.js'

const TABLE = 'parcelamento_pdfs'

const isLocalAuth = () => String(env.AUTH_MODE || '').trim().toLowerCase() === 'local'

const normalizeNumero = (value) => {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

const getDb = () => {
  if (!isLocalAuth() && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw badRequest('Persistência de PDF de parcelamento indisponível (configure Supabase ou AUTH_MODE=local).')
  }
  return createSupabaseClient({ useServiceRole: true })
}

export const upsertParcelamentoPdf = async ({
  userId,
  contribuinteNumero,
  numeroParcelamento,
  modalidade,
  pdfBase64,
}) => {
  if (!userId) {
    throw badRequest('Usuário não informado para persistência do PDF de parcelamento')
  }
  if (!pdfBase64) {
    throw badRequest('Base64 do PDF não informado')
  }
  const numero = normalizeNumero(numeroParcelamento)
  if (!numero) {
    throw badRequest('Número do parcelamento inválido')
  }
  const contribNumero = normalizeNumero(contribuinteNumero) || ''
  const modalidadeNorm = modalidade != null ? String(modalidade).trim() || null : null

  const db = getDb()
  const payload = {
    user_id: userId,
    contribuinte_numero: contribNumero,
    numero_parcelamento: numero,
    modalidade: modalidadeNorm,
    pdf_base64: pdfBase64,
  }

  const { data: existing, error: selectError } = await db
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('numero_parcelamento', numero)
    .maybeSingle()

  if (selectError) {
    throw badRequest(selectError.message || 'Falha ao consultar PDF de parcelamento')
  }

  if (existing?.id) {
    const { error } = await db
      .from(TABLE)
      .update({
        contribuinte_numero: contribNumero,
        modalidade: modalidadeNorm,
        pdf_base64: pdfBase64,
      })
      .eq('id', existing.id)
    if (error) {
      throw badRequest(error.message || 'Falha ao atualizar PDF de parcelamento')
    }
  } else {
    const { error } = await db.from(TABLE).insert(payload)
    if (error) {
      throw badRequest(error.message || 'Falha ao salvar PDF de parcelamento')
    }
  }

  return { userId, numeroParcelamento: numero }
}

export const getParcelamentoPdf = async ({ userId, numeroParcelamento }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para consulta do PDF de parcelamento')
  }
  const numero = normalizeNumero(numeroParcelamento)
  if (!numero) {
    throw badRequest('Número do parcelamento inválido')
  }

  const db = getDb()
  const { data, error } = await db
    .from(TABLE)
    .select('pdf_base64, modalidade, contribuinte_numero')
    .eq('user_id', userId)
    .eq('numero_parcelamento', numero)
    .maybeSingle()

  if (error) {
    throw badRequest(error.message || 'Falha ao consultar PDF de parcelamento')
  }
  return data
}
