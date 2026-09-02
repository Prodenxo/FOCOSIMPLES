import type { AppScreenName } from './navigationContext'

export const ACTIVATION_ROUTE_TO_SCREEN: Record<string, AppScreenName> = {
  'settings:profile': 'Configuracoes',
  'settings:phone': 'Configuracoes',
  'mei:certificate': 'Notas',
  'mei:das': 'Notas',
  'mei:nfse': 'Notas',
}

export function activationRouteToScreen (route: string): AppScreenName | null {
  return ACTIVATION_ROUTE_TO_SCREEN[route] ?? null
}
