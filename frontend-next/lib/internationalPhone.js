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

export function formatPhoneBrCell(digits) {
  const d = normalizePhoneDigits(digits);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function formatNationalPhoneInput(countryIso, nationalDigits) {
  const digits = String(nationalDigits || '').replace(/\D/g, '');
  if (!digits) return '';
  if (countryIso === 'br') {
    return formatPhoneBrCell(`55${digits}`).replace(/^55\s*/, '');
  }
  return digits;
}
