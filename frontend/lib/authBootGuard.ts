import type { Session } from '@supabase/supabase-js'
import type { UserRole } from './auth-roles'

/** Evita tela branca/spinner infinito se Supabase ou role resolver travar. */
export const AUTH_BOOT_TIMEOUT_MS = 12_000

export type AuthBootSetState = (partial: {
  user?: Session['user'] | null
  phone?: string | null
  displayName?: string | null
  userId?: string | null
  role?: UserRole | null
  mei?: boolean | null
  empresaId?: string | null
  isImpersonating?: boolean
  sessionRestored?: boolean
}) => void

/** Estado mínimo para liberar a UI quando o boot completo estoura o tempo. */
export function applyMinimalSessionState(
  session: Session,
  set: AuthBootSetState,
  isImpersonating: boolean,
): void {
  const phone = session.user.user_metadata?.phone || null
  const displayName = session.user.user_metadata?.display_name || null
  set({
    user: session.user,
    phone,
    displayName,
    userId: session.user.id || null,
    isImpersonating,
    sessionRestored: true,
  })
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label))
    }, ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}
