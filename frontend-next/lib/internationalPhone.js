import { getPhoneCountryByIso } from '@/lib/phoneCountries';

/** Dígitos nacionais (sem código do país) aceitos por país. */
const NATIONAL_MAX_DIGITS = { br: 11 };
const NATIONAL_MAX_DIGITS_FALLBACK = 15;

export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export function phonesMatch(left, right) {
  return normalizePhoneDigits(left) === normalizePhoneDigits(right);
}

/** Brasil: DDD + 8 ou 9 dígitos. */
export function getBrazilPhoneValidationError(digits) {
  const d = normalizePhoneDigits(digits);
  if (!d.startsWith('55')) return null;
  const national = d.slice(2);
  if (!national || national.length < 10 || national.length > 11) {
    return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).';
  }
  return null;
}

export function nationalPhoneMaxDigits(countryIso) {
  return NATIONAL_MAX_DIGITS[countryIso] ?? NATIONAL_MAX_DIGITS_FALLBACK;
}

/**
 * Remove o código do país só quando há dígito sobrando — assim um DDD igual ao
 * código (ex.: 55 do Rio Grande do Sul) continua intacto.
 */
function stripDialCode(digits, dialCode, maxNationalDigits) {
  if (digits.length > maxNationalDigits && digits.startsWith(dialCode)) {
    return digits.slice(dialCode.length);
  }
  return digits;
}

/** Aceita dígitos nacionais (DDD + número) ou o número completo com o 55 na frente. */
export function formatPhoneBrCell(digits) {
  const d = stripDialCode(normalizePhoneDigits(digits), '55', NATIONAL_MAX_DIGITS.br)
    .slice(0, NATIONAL_MAX_DIGITS.br);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/**
 * Dígitos que ficam no estado do campo. Tolera colar o número internacional
 * completo e mantém o valor exibido igual ao valor guardado.
 */
export function normalizeNationalPhoneInput(countryIso, value) {
  const digits = normalizePhoneDigits(value);
  const max = nationalPhoneMaxDigits(countryIso);
  const { dialCode } = getPhoneCountryByIso(countryIso);
  return stripDialCode(digits, dialCode, max).slice(0, max);
}

export function formatNationalPhoneInput(countryIso, nationalDigits) {
  const digits = normalizePhoneDigits(nationalDigits);
  if (!digits) return '';
  if (countryIso === 'br') return formatPhoneBrCell(digits);
  return digits;
}
