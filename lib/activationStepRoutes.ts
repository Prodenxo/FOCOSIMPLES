import type { AppScreenName } from './navigationContext'

export const ACTIVATION_ROUTE_TO_SCREEN: Record<string, AppScreenName> = {
  'settings:profile': 'Configuracoes',
  'settings:phone': 'Configuracoes',
  'mei:certificate': 'MeuMei',
  'mei:das': 'MeuMei',
  'mei:nfse': 'MeuMei',
}

export function activationRouteToScreen (route: string): AppScreenName | null {
  return ACTIVATION_ROUTE_TO_SCREEN[route] ?? null
}
