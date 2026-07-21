import { createSupabaseClient } from '../../config/supabase.js'
import { env } from '../../config/env.js'
import { badRequest } from '../../utils/errors.js'

const TABLE = 'das_simples'

const isLocalAuth = () => String(env.AUTH_MODE || '').trim().toLowerCase() === 'local'

const getDb = () => {
  if (!isLocalAuth() && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw badRequest('Persistência DAS Simples indisponível (Supabase/Postgres).')
  }
  return createSupabaseClient({ useServiceRole: true })
}

const normalizePeriodo = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 6) return null
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null
  return digits
}

const periodoToCompetencia = (periodo) => {
  const p = normalizePeriodo(periodo)
  if (!p) return null
  return `${p.slice(0, 4)}-${p.slice(4, 6)}`
}

/**
 * @param {{
 *   userId: string,
 *   cnpj: string,
 *   periodoApuracao: string,
 *   status?: string,
 *   pdfBase64?: string|null,
 *   numeroDocumento?: string|null,
 *   valorTotal?: number|null,
 *   detalhamento?: object|null,
 *   errorMessage?: string|null,
 * }} row
 */
export const upsertDasSimples = async (row) => {
  const userId = row?.userId
  const cnpj = String(row?.cnpj || '').replace(/\D/g, '')
  const periodo = normalizePeriodo(row?.periodoApuracao)
  if (!userId || cnpj.length !== 14 || !periodo) {
    throw badRequest('Dados inválidos para persistir DAS Simples.')
  }
  const competencia = periodoToCompetencia(periodo)
  const db = getDb()
  const payload = {
    user_id: userId,
    cnpj,
    periodo_apuracao: periodo,
    competencia,
    status: row.status || 'gerado',
    pdf_base64: row.pdfBase64 || null,
    numero_documento: row.numeroDocumento || null,
    valor_total: row.valorTotal ?? null,
    detalhamento_json: row.detalhamento || null,
    error_message: row.errorMessage || null,
    source: 'pgdasd',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from(TABLE)
    .upsert(payload, { onConflict: 'user_id,periodo_apuracao' })
    .select('*')
    .maybeSingle()

  if (error) {
    throw badRequest(error.message || 'Falha ao salvar DAS Simples.')
  }
  return data
}

export const getDasSimplesByPeriodo = async ({ userId, periodoApuracao }) => {
  const periodo = normalizePeriodo(periodoApuracao)
  if (!userId || !periodo) return null
  const db = getDb()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('periodo_apuracao', periodo)
    .maybeSingle()
  if (error) {
    throw badRequest(error.message || 'Falha ao consultar DAS Simples.')
  }
  return data
}

export const listDasSimplesPeriods = async ({ userId, limit = 24 } = {}) => {
  if (!userId) return []
  const db = getDb()
  const { data, error } = await db
    .from(TABLE)
    .select('id, competencia, periodo_apuracao, status, numero_documento, valor_total, error_message, updated_at')
    .eq('user_id', userId)
    .order('periodo_apuracao', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 24, 1), 48))
  if (error) {
    throw badRequest(error.message || 'Falha ao listar DAS Simples.')
  }
  return data || []
}
