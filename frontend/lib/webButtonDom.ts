import { Platform } from 'react-native'

type WebClickEvent = {
  preventDefault?: () => void
  stopPropagation?: () => void
}

/** Evita submit de formulário implícito no RN Web (Enter / botão padrão). */
export function getWebButtonDomProps (): Record<string, unknown> {
  if (Platform.OS !== 'web') return {}

  return {
    type: 'button',
    onClick: (event: WebClickEvent) => {
      event?.preventDefault?.()
      event?.stopPropagation?.()
    },
  }
}
