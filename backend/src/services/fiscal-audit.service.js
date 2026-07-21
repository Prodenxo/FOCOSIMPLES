/**
 * Auditoria fiscal sem dados sensíveis de certificado.
 */
import { createSupabaseClient } from '../config/supabase.js'
import { env } from '../config/env.js'

const TABLE = 'fiscal_certificate_audit'

const getDb = () => {
  try {
    if (String(env.AUTH_MODE || '').trim().toLowerCase() === 'local') {
      return createSupabaseClient({ useServiceRole: true })
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
    return createSupabaseClient({ useServiceRole: true })
  } catch {
    return null
  }
}

/**
 * @param {{
 *   empresaId?: string|null,
 *   userId?: string|null,
 *   acao: string,
 *   cnpj?: string|null,
 *   detalhe?: string|null,
 * }} entry
 */
export const recordFiscalAudit = async (entry) => {
  const db = getDb()
  if (!db) {
    if (env.NODE_ENV !== 'production') {
      console.info('[fiscal-audit]', {
        acao: entry.acao,
        cnpj: entry.cnpj ? `${String(entry.cnpj).slice(0, 4)}***` : null,
        detalhe: entry.detalhe || null,
      })
    }
    return
  }
  try {
    await db.from(TABLE).insert({
      empresa_id: entry.empresaId || null,
      user_id: entry.userId || null,
      acao: String(entry.acao || 'unknown').slice(0, 80),
      cnpj: entry.cnpj ? String(entry.cnpj).replace(/\D/g, '').slice(0, 14) : null,
      detalhe_nao_sensivel: entry.detalhe ? String(entry.detalhe).slice(0, 500) : null,
    })
  } catch (err) {
    console.warn('[fiscal-audit] falha ao gravar', err instanceof Error ? err.message : String(err))
  }
}
