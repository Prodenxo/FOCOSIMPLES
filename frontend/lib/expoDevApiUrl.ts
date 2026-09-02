import Constants from 'expo-constants'
import { Platform } from 'react-native'

type RewriteLocalhostOptions = {
  lanHost?: string | null
  platform?: string
}

/** IP/hostname da máquina de dev (Metro) — ex.: 192.168.0.12:8081 → 192.168.0.12 */
export function resolveExpoDevMachineHost (): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { linkingUri?: string }).linkingUri ||
    null

  if (!hostUri) return null

  const withoutProtocol = String(hostUri).replace(/^https?:\/\//, '')
  const host = withoutProtocol.split('/')[0]?.split(':')[0]?.trim()

  if (!host || /^localhost$/i.test(host) || host === '127.0.0.1') {
    return null
  }

  return host
}

/**
 * No Expo Go (celular/emulador), localhost aponta para o aparelho — não para o PC.
 * Troca localhost pelo IP do Metro quando disponível.
 */
export function rewriteLocalhostDevApiUrl (
  url: string,
  options: RewriteLocalhostOptions = {},
): string {
  const platform = options.platform ?? Platform.OS
  if (platform === 'web' || !url) return url
  if (!/localhost|127\.0\.0\.1/i.test(url)) return url

  const lanHost = options.lanHost ?? resolveExpoDevMachineHost()
  if (!lanHost) return url

  return url
    .replace(/localhost/gi, lanHost)
    .replace(/127\.0\.0\.1/g, lanHost)
}
