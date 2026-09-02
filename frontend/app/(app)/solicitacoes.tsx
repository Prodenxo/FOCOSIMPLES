import { Redirect } from 'expo-router'
import { SETTINGS_ROUTES } from '@/lib/settingsRoutes'

/** Compatibilidade: /solicitacoes → /configuracoes/solicitacoes */
export default function SolicitacoesLegacyRedirect() {
  return <Redirect href={SETTINGS_ROUTES.solicitacoes} />
}
