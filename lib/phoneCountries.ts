import { ALL_PHONE_COUNTRIES } from './phoneCountriesAll.generated'

export type PhoneCountry = {
  iso: string
  name: string
  dialCode: string
  flag: string
}

const byIso = new Map(ALL_PHONE_COUNTRIES.map((country) => [country.iso, country]))

/** Converte ISO 3166-1 alpha-2 em emoji de bandeira (ex.: br → 🇧🇷). */
export function isoToFlagEmoji (iso: string): string {
  const code = iso.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'

  const base = 0x1f1e6
  return String.fromCodePoint(
    ...code.split('').map((char) => base + char.charCodeAt(0) - 65),
  )
}

export function getCountryFlag (country: Pick<PhoneCountry, 'iso' | 'flag'>): string {
  if (country.flag && country.flag !== '🌐') return country.flag
  return isoToFlagEmoji(country.iso)
}

export function getPhoneCountryByIso (iso: string): PhoneCountry {
  return byIso.get(iso) ?? ALL_PHONE_COUNTRIES[0]
}

export function detectPhoneCountryFromDigits (digits: string): PhoneCountry {
  const normalized = digits.replace(/\D/g, '')
  if (!normalized) return ALL_PHONE_COUNTRIES[0]

  const sorted = [...ALL_PHONE_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  )

  for (const country of sorted) {
    if (normalized.startsWith(country.dialCode)) {
      return country
    }
  }

  return ALL_PHONE_COUNTRIES[0]
}

export function splitInternationalPhone (
  value: string,
  fallbackIso = 'br',
): { country: PhoneCountry; nationalDigits: string } {
  const digits = value.replace(/\D/g, '')
  if (!digits) {
    return { country: getPhoneCountryByIso(fallbackIso), nationalDigits: '' }
  }

  const country = detectPhoneCountryFromDigits(digits)
  const nationalDigits = digits.startsWith(country.dialCode)
    ? digits.slice(country.dialCode.length)
    : digits

  return { country, nationalDigits }
}

export function buildInternationalPhone (
  country: PhoneCountry,
  nationalDigits: string,
): string {
  const national = nationalDigits.replace(/\D/g, '')
  if (!national) return ''
  return `${country.dialCode}${national}`
}

export { ALL_PHONE_COUNTRIES }
