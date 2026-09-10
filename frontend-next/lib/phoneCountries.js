/** Países comuns para telefone internacional (subset do Expo). */
export const PHONE_COUNTRIES = [
  { iso: 'br', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
  { iso: 'us', name: 'Estados Unidos', dialCode: '1', flag: '🇺🇸' },
  { iso: 'pt', name: 'Portugal', dialCode: '351', flag: '🇵🇹' },
  { iso: 'ar', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { iso: 'py', name: 'Paraguai', dialCode: '595', flag: '🇵🇾' },
];

export function getPhoneCountryByIso(iso) {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) || PHONE_COUNTRIES[0];
}

export function detectPhoneCountryFromDigits(digits) {
  const normalized = String(digits || '').replace(/\D/g, '');
  if (!normalized) return PHONE_COUNTRIES[0];
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of sorted) {
    if (normalized.startsWith(country.dialCode)) return country;
  }
  return PHONE_COUNTRIES[0];
}

export function splitInternationalPhone(value, fallbackIso = 'br') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return { country: getPhoneCountryByIso(fallbackIso), nationalDigits: '' };
  }
  const country = detectPhoneCountryFromDigits(digits);
  const nationalDigits = digits.startsWith(country.dialCode)
    ? digits.slice(country.dialCode.length)
    : digits;
  return { country, nationalDigits };
}

export function buildInternationalPhone(country, nationalDigits) {
  const national = String(nationalDigits || '').replace(/\D/g, '');
  if (!national) return '';
  return `${country.dialCode}${national}`;
}
