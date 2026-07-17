import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { Href } from 'expo-router'
import { fetchActivationProgress } from '@/services/activationService'
import { isSessionActivationSkipped } from '@/lib/activationSession'
import { ACTIVATION_ROUTE, EMPRESA_CNPJ_ONBOARDING_ROUTE, MEI_BILLING_PLANS_ROUTE } from '@/lib/settingsRoutes'
import { isEmpresaCnpjOnboardingRequired } from '@/lib/empresaCnpjGate'
import { shouldRequireMeiBillingRoute } from '@/lib/meiBillingGate'

const RETURN_PATH_KEY = 'auth_return_path_v1'

const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot',
  '/reset-password',
  '/onboarding',
  '/solicitar-acesso',
  '/privacidade',
  '/termos',
]

/** Caminho público do browser ou pathname do Expo Router. */
export function getCurrentReturnPath(pathname?: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { pathname: p, search } = window.location
    return `${p}${search}`
  }
  return pathname || '/'
}

export function isAuthPublicPath(path: string): boolean {
  const base = path.split('?')[0].replace(/\/$/, '') || '/'
  if (base === '/') return false
  return AUTH_ROUTE_PREFIXES.some(
    (prefix) => base === prefix || base.startsWith(`${prefix}/`),
  )
}

/** Converte URL do browser (/transacoes) em href do Expo Router. */
export function pathToExpoHref(path: string): Href {
  const safePath = String(path ?? '/').trim() || '/'
  const [pathname, query = ''] = safePath.split('?')
  const normalized = (pathname ?? '/').replace(/\/$/, '') || '/'

  if (normalized.startsWith('/(app)') || normalized.startsWith('/(auth)')) {
    return (query ? `${normalized}?${query}` : normalized) as Href
  }

  if (normalized === '/') {
    return '/(app)/' as Href
  }

  if (isAuthPublicPath(normalized)) {
    return '/(auth)/login' as Href
  }

  const appPath = normalized.startsWith('/') ? normalized : `/${normalized}`
  const href = `/(app)${appPath}`
  return (query ? `${href}?${query}` : href) as Href
}

export async function stashAuthReturnPath(path: string): Promise<void> {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '/' || isAuthPublicPath(trimmed)) return
  try {
    await AsyncStorage.setItem(RETURN_PATH_KEY, trimmed)
  } catch {
    /* ignore */
  }
}

export async function consumeAuthReturnPath(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(RETURN_PATH_KEY)
    if (stored) {
      await AsyncStorage.removeItem(RETURN_PATH_KEY)
      return stored
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Admin da empresa sem CNPJ salvo → cadastro obrigatório (uma vez). */
export async function shouldRequireEmpresaCnpjOnboardingRoute (): Promise<boolean> {
  return isEmpresaCnpjOnboardingRequired()
}

/** Ativação essencial incompleta → usuário deve ir para /ativacao (salvo se pulou nesta sessão). */
export async function shouldRequireActivationRoute (): Promise<boolean> {
  if (isSessionActivationSkipped()) return false
  const data = await fetchActivationProgress()
  if (!data) return false
  const coreDone = data.progress.isCoreComplete ?? data.progress.isComplete
  return !coreDone
}

export async function resolvePostAuthHref (fallback: Href): Promise<Href> {
  if (await shouldRequireEmpresaCnpjOnboardingRoute()) {
    await consumeAuthReturnPath()
    return EMPRESA_CNPJ_ONBOARDING_ROUTE as Href
  }
  if (await shouldRequireMeiBillingRoute()) {
    await consumeAuthReturnPath()
    return MEI_BILLING_PLANS_ROUTE as Href
  }
  if (await shouldRequireActivationRoute()) {
    await consumeAuthReturnPath()
    return ACTIVATION_ROUTE as Href
  }
  const stored = await consumeAuthReturnPath()
  if (stored) return pathToExpoHref(stored)
  return fallback
}
