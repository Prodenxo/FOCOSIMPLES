import { formatPhoneBrCell } from './numberFormat'

export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

export function phonesMatch(
  left?: string | null,
  right?: string | null,
): boolean {
  return normalizePhoneDigits(left) === normalizePhoneDigits(right)
}

/** Brasil: DDD + 8 ou 9 dígitos (com ou sem nono dígito móvel). */
export function getBrazilPhoneValidationError(digits: string): string | null {
  const d = normalizePhoneDigits(digits)
  if (!d.startsWith('55')) return null
  const national = d.slice(2)
  if (!national || national.length < 10 || national.length > 11) {
    return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).'
  }
  return null
}

export function formatNationalPhoneInput(
  countryIso: string,
  nationalDigits: string,
): string {
  const digits = nationalDigits.replace(/\D/g, '')
  if (!digits) return ''

  if (countryIso === 'br') {
    return formatPhoneBrCell(digits).replace(/^55\s*/, '')
  }

  return digits
}
