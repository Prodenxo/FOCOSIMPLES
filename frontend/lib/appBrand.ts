import { Platform } from 'react-native'
import { getPublicEnv } from './runtimeEnv'

/** Nome oficial da marca FocoSimples. */
export const APP_BRAND_NAME = 'FocoSimples'

export const APP_BRAND_TAGLINE =
  'Finanças e obrigações do Simples. Você cuida do negócio.'

/** Label da aba/tela principal (área fiscal Simples). */
export const APP_NAV_HOME_LABEL = 'Área fiscal'

export function getAppPublicOrigin (): string {
  const fromEnv = getPublicEnv('EXPO_PUBLIC_INVITE_APP_BASE_URL').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

export function appPublicUrl (path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const origin = getAppPublicOrigin()
  if (origin) return `${origin}${normalized}`
  return normalized
}
