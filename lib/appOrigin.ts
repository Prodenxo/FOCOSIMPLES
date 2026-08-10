import { Platform } from 'react-native'
import { getPublicEnv } from './runtimeEnv'

export type AppOrigin = 'focosimples' | 'focomei' | 'financeiro'

const APP_PRODUCT_LABELS: Record<AppOrigin, string> = {
  focosimples: 'Foco Simples',
  focomei: 'FocoMEI',
  financeiro: 'Meu Financeiro',
}

/** Nome exibido na UI (splash, títulos) conforme produto. */
export function appProductDisplayName (origin?: string | null): string {
  const key = String(origin || resolveAppOrigin()).trim().toLowerCase() as AppOrigin
  return APP_PRODUCT_LABELS[key] ?? APP_PRODUCT_LABELS.focosimples
}

/** Origem do cadastro — sem SQL; gravado em `user_metadata`. */
export function resolveAppOrigin (): AppOrigin {
  const fromEnv = getPublicEnv('EXPO_PUBLIC_APP_PRODUCT').trim().toLowerCase()
  if (fromEnv === 'focosimples' || fromEnv === 'focomei' || fromEnv === 'financeiro') {
    return fromEnv
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('focosimples')) return 'focosimples'
    if (host.includes('focomei')) return 'focomei'
    if (host.includes('meiinfinito') || host.includes('meufinanceiro')) return 'financeiro'
  }

  // App deste pacote = FocoSimples
  return 'focosimples'
}

export function signupOriginMetadata (): Record<string, string> {
  const origin = resolveAppOrigin()
  return {
    app_origin: origin,
    product_line: origin,
  }
}
