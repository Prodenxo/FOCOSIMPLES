import type { Router } from 'expo-router'

/** Rotas de configurações — URLs reais no web (ex.: /configuracoes/solicitacoes). */
export const SETTINGS_ROUTES = {
  index: '/(app)/configuracoes',
  usuarios: '/(app)/configuracoes/usuarios',
  solicitacoes: '/(app)/configuracoes/solicitacoes',
} as const

/** Checklist pós-login (ativação guiada). */
export const ACTIVATION_ROUTE = '/(app)/ativacao' as const

/** Cadastro obrigatório de CNPJ (admin da empresa, uma vez). */
export const EMPRESA_CNPJ_ONBOARDING_ROUTE = '/(app)/empresa-cnpj' as const

/** Escolha de plano MEI + Checkout Stripe (self-serve). */
export const MEI_BILLING_PLANS_ROUTE = '/(app)/planos' as const

export type SettingsRouteHref = (typeof SETTINGS_ROUTES)[keyof typeof SETTINGS_ROUTES]

/** Voltar sem erro GO_BACK quando não há histórico (F5 em rota profunda). */
export function goBackToSettings(
  router: Pick<Router, 'back' | 'replace' | 'canGoBack'>,
): void {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace(SETTINGS_ROUTES.index)
}
