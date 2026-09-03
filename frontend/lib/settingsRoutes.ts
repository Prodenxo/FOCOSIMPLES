import type { Router } from 'expo-router'
import { Platform } from 'react-native'

/** Rotas de configurações — URLs reais no web (ex.: /configuracoes/solicitacoes). */
export const SETTINGS_ROUTES = {
  index: '/(app)/configuracoes',
  usuarios: '/(app)/configuracoes/usuarios',
  solicitacoes: '/(app)/configuracoes/solicitacoes',
  produtosFiscais: '/(app)/configuracoes/produtos-fiscais',
} as const

/** Checklist pós-login (ativação guiada). */
export const ACTIVATION_ROUTE = '/(app)/ativacao' as const

/** Cadastro obrigatório de CNPJ (admin da empresa, uma vez). */
export const EMPRESA_CNPJ_ONBOARDING_ROUTE = '/(app)/empresa-cnpj' as const

/** Escolha de plano MEI + Checkout Stripe (self-serve). */
export const MEI_BILLING_PLANS_ROUTE = '/(app)/planos' as const

export type SettingsRouteHref = (typeof SETTINGS_ROUTES)[keyof typeof SETTINGS_ROUTES]

/** Voltar sem erro GO_BACK quando não há histórico (F5 em rota profunda). */
export function safeRouterBack(
  router: Pick<Router, 'back' | 'replace' | 'canGoBack'>,
  fallbackHref: string,
): void {
  // No web, canGoBack() pode ser true pelo histórico do navegador
  // mesmo sem tela anterior no app — isso dispara o aviso GO_BACK.
  if (Platform.OS !== 'web') {
    try {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back()
        return
      }
    } catch {
      /* navigator sem stack */
    }
  }
  router.replace(fallbackHref as never)
}

export function goBackToSettings(
  router: Pick<Router, 'back' | 'replace' | 'canGoBack'>,
): void {
  safeRouterBack(router, SETTINGS_ROUTES.index)
}
