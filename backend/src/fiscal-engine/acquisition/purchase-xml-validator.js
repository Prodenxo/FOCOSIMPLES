import { createHash } from 'node:crypto';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * Valida chave NF-e (44 dígitos + DV módulo 11).
 * @param {string} chave
 */
export const validateChaveNFe = (chave) => {
  const digits = onlyDigits(chave, 44);
  if (digits.length !== 44) return { ok: false, reason: 'Chave deve ter 44 dígitos' };

  const base = digits.slice(0, 43);
  const dvInformado = Number(digits[43]);
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dvCalculado = resto === 0 || resto === 1 ? 0 : 11 - resto;
  if (dvCalculado !== dvInformado) {
    return { ok: false, reason: 'Dígito verificador da chave inválido' };
  }
  return { ok: true, chave: digits };
};

/**
 * @param {string} infNfeId
 * @param {string} chave
 */
export const validateInfNFeIdMatchesChave = (infNfeId, chave) => {
  const id = String(infNfeId || '').trim();
  const ch = onlyDigits(chave, 44);
  if (!id || !ch) return { ok: false, reason: 'infNFe@Id ou chave ausente' };
  const expected = `NFe${ch}`;
  if (id !== expected) {
    return { ok: false, reason: `infNFe@Id esperado ${expected}, recebido ${id}` };
  }
  return { ok: true };
};

/**
 * @param {Buffer|string} xmlBuffer
 */
export const sha256Hex = (xmlBuffer) => {
  const buf = Buffer.isBuffer(xmlBuffer) ? xmlBuffer : Buffer.from(String(xmlBuffer), 'utf8');
  return createHash('sha256').update(buf).digest('hex');
};

export { onlyDigits };
