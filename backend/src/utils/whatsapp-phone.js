/**
 * Telefone vindo do WhatsApp / Z-API / perfil: parte antes de @, só dígitos.
 * Usar em `n8n_link.user_number` e no lookup Hermes para bater sempre igual.
 */
export const normalizeWhatsappPhoneDigits = (raw) => {
  if (raw === null || raw === undefined) return '';
  const beforeAt = String(raw).split('@')[0];
  return beforeAt.replace(/\D/g, '');
};

/**
 * Parte nacional (sem 55): DDD + assinante.
 * @param {string} national
 */
const expandBrazilNationalMobileVariants = (national) => {
  const out = new Set();
  const n = String(national || '').replace(/\D/g, '');
  if (n.length < 10) return out;
  out.add(n);

  if (n.length === 10) {
    const ddd = n.slice(0, 2);
    const sub = n.slice(2);
    // Celular legado (8 dígitos, costuma começar com 6–9): insere o 9 após o DDD.
    if (/^[6-9]/.test(sub)) {
      out.add(`${ddd}9${sub}`);
    }
  }

  if (n.length === 11) {
    const ddd = n.slice(0, 2);
    const afterDdd = n.slice(2);
    if (afterDdd.startsWith('9') && afterDdd.length === 9) {
      out.add(`${ddd}${afterDdd.slice(1)}`);
    }
  }

  return out;
};

/**
 * Variantes com/sem nono dígito e com/sem DDI 55 (lookup Z-API ↔ n8n_link).
 * @param {string} digits
 * @returns {string[]}
 */
export const expandBrazilMobilePhoneVariants = (digits) => {
  const d = normalizeWhatsappPhoneDigits(digits);
  if (!d) return [];

  const variants = new Set([d]);

  const national = d.startsWith('55') ? d.slice(2) : d;
  for (const nat of expandBrazilNationalMobileVariants(national)) {
    variants.add(nat);
    variants.add(`55${nat}`);
  }

  return [...variants];
};

/**
 * Brasil: DDI 55 ou número nacional com 10–11 dígitos (DDD + assinante).
 * @param {string} digits
 */
export const isBrazilWhatsappDigits = (digits) => {
  const d = normalizeWhatsappPhoneDigits(digits);
  if (!d) return false;
  if (d.startsWith('55')) return true;
  return d.length >= 10 && d.length <= 11;
};

/**
 * Variantes para lookup `n8n_link`: regras BR (nono dígito) ou match exacto internacional.
 * @param {string} digits
 * @returns {string[]}
 */
export const expandWhatsappPhoneLookupVariants = (digits) => {
  const d = normalizeWhatsappPhoneDigits(digits);
  if (!d) return [];
  if (isBrazilWhatsappDigits(d)) {
    return expandBrazilMobilePhoneVariants(d);
  }
  return [d];
};

/**
 * Formato canónico para gravar em perfil / `n8n_link`.
 * @param {string} digits
 * @returns {string}
 */
export const canonicalizeWhatsappPhone = (digits) => {
  const d = normalizeWhatsappPhoneDigits(digits);
  if (!d) return '';
  if (isBrazilWhatsappDigits(d)) {
    return canonicalizeBrazilWhatsappPhone(d);
  }
  return d;
};

/**
 * Formato canónico para gravar em `n8n_link` (prefere 55 + 11 dígitos nacionais).
 * @param {string} digits
 * @returns {string}
 */
export const canonicalizeBrazilWhatsappPhone = (digits) => {
  const variants = expandBrazilMobilePhoneVariants(digits);
  if (!variants.length) return normalizeWhatsappPhoneDigits(digits);

  const with55 = variants.filter((v) => v.startsWith('55'));
  const pool = with55.length ? with55 : variants;
  pool.sort((a, b) => b.length - a.length);
  return pool[0];
};
