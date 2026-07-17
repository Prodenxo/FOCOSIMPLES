import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useEffect } from 'react'
import { Linking } from 'react-native'
import { getPublicEnv } from './runtimeEnv'

export const PASSWORD_RECOVERY_PREFIX = 'financas-pessoais://reset-password'

export type PasswordRecoveryPayload =
  | {
      mode: 'session'
      accessToken: string
      refreshToken: string
      type: 'recovery'
    }
  | {
      mode: 'token_hash'
      tokenHash: string
      type: 'recovery'
    }

export type ParsedPasswordRecoveryUrl =
  | { kind: 'ignored' }
  | { kind: 'invalid_recovery_link' }
  | ({ kind: 'password_recovery' } & PasswordRecoveryPayload)

function parseParamsFromRawUrl (url: string): URLSearchParams {
  const hashIndex = url.indexOf('#')
  const queryIndex = url.indexOf('?')

  const queryRaw = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : ''
  const hashRaw = hashIndex >= 0 ? url.slice(hashIndex + 1) : ''

  const params = new URLSearchParams(queryRaw)
  const hashParams = new URLSearchParams(hashRaw)
  hashParams.forEach((value, key) => params.set(key, value))
  return params
}

export function isPasswordRecoveryPath (pathname: string): boolean {
  const base = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/'
  return base === '/reset-password' || base.endsWith('/reset-password')
}

function isPasswordRecoveryUrl (url: string): boolean {
  if (!url) return false
  if (url.startsWith(PASSWORD_RECOVERY_PREFIX)) return true

  try {
    const parsed = new URL(url, 'http://localhost')
    return isPasswordRecoveryPath(parsed.pathname)
  } catch {
    return url.includes('/reset-password')
  }
}

/** URL de redirect no e-mail Supabase (web ou deep link mobile). */
export function getPasswordResetRedirectUrl (): string {
  const publicBase = getPublicEnv('EXPO_PUBLIC_INVITE_APP_BASE_URL').replace(/\/$/, '')

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '')
    if (publicBase && !origin.includes('meiinfinito.com.br')) {
      return `${publicBase}/reset-password`
    }
    return `${origin}/reset-password`
  }

  if (publicBase) {
    return `${publicBase}/reset-password`
  }

  const scheme = Constants.expoConfig?.scheme || 'financas-pessoais'
  return `${scheme}://reset-password`
}

/**
 * Parser para links de reset Supabase (deep link ou /reset-password na web).
 * Tokens podem vir em query e/ou hash (#access_token=...&type=recovery).
 */
export function parsePasswordRecoveryUrl (url: string): ParsedPasswordRecoveryUrl {
  if (!isPasswordRecoveryUrl(url)) {
    return { kind: 'ignored' }
  }

  try {
    const params = parseParamsFromRawUrl(url)
    const type = params.get('type')
    const tokenHash = params.get('token_hash') || ''

    if (type !== 'recovery') {
      return { kind: 'invalid_recovery_link' }
    }

    if (tokenHash) {
      return {
        kind: 'password_recovery',
        mode: 'token_hash',
        tokenHash,
        type: 'recovery',
      }
    }

    const accessToken = params.get('access_token') || ''
    const refreshToken = params.get('refresh_token') || ''

    if (!accessToken || !refreshToken) {
      return { kind: 'invalid_recovery_link' }
    }

    return {
      kind: 'password_recovery',
      mode: 'session',
      accessToken,
      refreshToken,
      type: 'recovery',
    }
  } catch {
    return { kind: 'invalid_recovery_link' }
  }
}

/**
 * Web: lê tokens do hash antes do router redirecionar para a home.
 * Remove o hash da barra de endereço para não reprocessar.
 */
export function capturePasswordRecoveryFromUrlSync (): PasswordRecoveryPayload | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null

  const parsed = parsePasswordRecoveryUrl(window.location.href)
  if (parsed.kind !== 'password_recovery') return null

  try {
    const title = typeof document !== 'undefined' ? document.title : ''
    window.history.replaceState({}, title, window.location.pathname)
  } catch {
    /* ignore */
  }

  return {
    ...(parsed.mode === 'token_hash'
      ? { mode: 'token_hash' as const, tokenHash: parsed.tokenHash, type: 'recovery' as const }
      : {
          mode: 'session' as const,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          type: 'recovery' as const,
        }),
  }
}

export type PasswordRecoveryDeepLinkHandlers = {
  onRecovery: (payload: PasswordRecoveryPayload) => void
  onInvalidRecoveryLink: () => void
}

export function handlePasswordRecoveryDeepLinkUrl (
  url: string,
  handlers: PasswordRecoveryDeepLinkHandlers,
): void {
  const parsed = parsePasswordRecoveryUrl(url)
  if (parsed.kind === 'password_recovery') {
    handlers.onRecovery(parsed)
    return
  }
  if (parsed.kind === 'invalid_recovery_link') {
    handlers.onInvalidRecoveryLink()
  }
}

export function subscribePasswordRecoveryDeepLinks (
  handlers: PasswordRecoveryDeepLinkHandlers,
): () => void {
  const run = (url: string | null) => {
    if (!url) return
    handlePasswordRecoveryDeepLinkUrl(url, handlers)
  }

  void Linking.getInitialURL().then(run)
  const sub = Linking.addEventListener('url', (e) => run(e.url))
  return () => sub.remove()
}

export function usePasswordRecoveryDeepLink (handlers: PasswordRecoveryDeepLinkHandlers) {
  useEffect(() => subscribePasswordRecoveryDeepLinks(handlers), [handlers])
}
