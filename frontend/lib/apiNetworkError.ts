import { Platform } from 'react-native'
import { getMeiApiBaseUrl } from './runtimeEnv'

const NETWORK_ERROR_RE =
  /network request failed|failed to fetch|network error|fetch failed/i

export function isApiNetworkError (message: string): boolean {
  return NETWORK_ERROR_RE.test(message.trim())
}

export function formatApiNetworkError (message: string): string {
  if (!isApiNetworkError(message)) return message

  const api = getMeiApiBaseUrl() || '(não configurada)'

  if (Platform.OS !== 'web' && /localhost|127\.0\.0\.1/i.test(api)) {
    return (
      `Não foi possível conectar ao servidor (${api}). ` +
      'No celular, configure EXPO_PUBLIC_MEI_API_URL_DEV com o IP do seu PC ' +
      '(ex.: http://192.168.0.12:3333), deixe o backend rodando e use a mesma rede Wi‑Fi.'
    )
  }

  return (
    `Não foi possível conectar ao servidor (${api}). ` +
    'Verifique sua internet e se o backend está online.'
  )
}
