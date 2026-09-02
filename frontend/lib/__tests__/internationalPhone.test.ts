import { getCountryFlagImageUrl } from '../countryFlagImage'
import {
  normalizePhoneDigits,
  phonesMatch,
  formatNationalPhoneInput,
  getBrazilPhoneValidationError,
} from '../internationalPhone'
import {
  buildInternationalPhone,
  detectPhoneCountryFromDigits,
  getPhoneCountryByIso,
  isoToFlagEmoji,
  splitInternationalPhone,
} from '../phoneCountries'

describe('internationalPhone', () => {
  test('normalizePhoneDigits remove máscara', () => {
    expect(normalizePhoneDigits('55 (21) 99618-5328')).toBe('5521996185328')
  })

  test('phonesMatch compara só dígitos', () => {
    expect(phonesMatch('5521996185328', '55 21 996185328')).toBe(true)
  })

  test('splitInternationalPhone separa Brasil', () => {
    const { country, nationalDigits } = splitInternationalPhone('5521996185328')
    expect(country.iso).toBe('br')
    expect(nationalDigits).toBe('21996185328')
  })

  test('detectPhoneCountryFromDigits reconhece Portugal', () => {
    expect(detectPhoneCountryFromDigits('351912345678').iso).toBe('pt')
  })

  test('buildInternationalPhone monta número completo', () => {
    expect(buildInternationalPhone(getPhoneCountryByIso('br'), '21996185328')).toBe(
      '5521996185328',
    )
  })

  test('getBrazilPhoneValidationError aceita 10 e 11 dígitos nacionais', () => {
    expect(getBrazilPhoneValidationError('556696851098')).toBeNull()
    expect(getBrazilPhoneValidationError('5521996185328')).toBeNull()
    expect(getBrazilPhoneValidationError('5521996185')).not.toBeNull()
  })

  test('formatNationalPhoneInput formata celular BR', () => {
    expect(formatNationalPhoneInput('br', '21996185328')).toContain('(21)')
  })
})

describe('isoToFlagEmoji', () => {
  test('gera bandeira do Brasil', () => {
    expect(isoToFlagEmoji('br')).toBe('🇧🇷')
  })

  test('gera bandeira dos EUA', () => {
    expect(isoToFlagEmoji('us')).toBe('🇺🇸')
  })
})

describe('getCountryFlagImageUrl', () => {
  test('monta URL flagcdn com ISO minúsculo', () => {
    expect(getCountryFlagImageUrl('BR', 20)).toBe('https://flagcdn.com/w27/br.png')
  })
})
