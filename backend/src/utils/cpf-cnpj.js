/**
 * Validação de CPF/CNPJ com dígitos verificadores (evita tomadores fantasma no OpenClaw).
 */

export const normalizeDocDigits = (value) => String(value || '').replace(/\D/g, '');

const allSameDigit = (digits) => /^(\d)\1+$/.test(digits);

const calcCpfCheckDigit = (digits, factorStart) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    sum += Number(digits[i]) * (factorStart - i);
  }
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
};

export const isValidCpf = (value) => {
  const digits = normalizeDocDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  const d1 = calcCpfCheckDigit(digits.slice(0, 9), 10);
  if (d1 !== Number(digits[9])) return false;
  const d2 = calcCpfCheckDigit(digits.slice(0, 10), 11);
  return d2 === Number(digits[10]);
};

const calcCnpjCheckDigit = (digits, weights) => {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += Number(digits[i]) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
};

export const isValidCnpj = (value) => {
  const digits = normalizeDocDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcCnpjCheckDigit(digits, w1);
  if (d1 !== Number(digits[12])) return false;
  const d2 = calcCnpjCheckDigit(digits, w2);
  return d2 === Number(digits[13]);
};

export const isValidCpfOrCnpj = (value) => {
  const digits = normalizeDocDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
};

export const formatCnpjDisplay = (value) => {
  const d = normalizeDocDigits(value);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};
