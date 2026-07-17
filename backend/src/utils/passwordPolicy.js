import crypto from 'crypto';
import { badRequest } from './errors.js';

/** Alinhado ao frontend em `frontend/src/lib/passwordPolicy.ts` — manter regras iguais. */
export const STRONG_PASSWORD_MIN_LENGTH = 8;
export const STRONG_PASSWORD_MAX_LENGTH = 128;

/** Caracteres especiais aceitos (evita aspas e espaço por simplicidade em formulários). */
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;

const CHARSET_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHARSET_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const CHARSET_DIGIT = '23456789';
const CHARSET_SPECIAL = '!@#$%&*-_=+';

/**
 * @param {string} password
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export const validateStrongPassword = (password) => {
  const p = String(password ?? '').trim();
  if (!p) {
    return { ok: false, message: 'Senha é obrigatória' };
  }
  if (p.length < STRONG_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres`
    };
  }
  if (p.length > STRONG_PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `A senha deve ter no máximo ${STRONG_PASSWORD_MAX_LENGTH} caracteres` };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, message: 'Inclua pelo menos uma letra maiúscula (A-Z)' };
  }
  if (!SPECIAL_RE.test(p)) {
    return {
      ok: false,
      message: 'Inclua pelo menos um caractere especial (ex.: ! @ # $ % & * - _ = + )'
    };
  }
  return { ok: true };
};

/**
 * @param {string} password
 * @throws {import('./errors.js').HttpError}
 */
export const assertStrongPassword = (password) => {
  const r = validateStrongPassword(password);
  if (!r.ok) throw badRequest(r.message);
};

/**
 * Senha aleatória que satisfaz `validateStrongPassword` (admin / criação automática).
 * @param {number} [length]
 */
export const generateStrongRandomPassword = (length = 16) => {
  const target = Math.max(
    STRONG_PASSWORD_MIN_LENGTH,
    Math.min(STRONG_PASSWORD_MAX_LENGTH, Number(length) || 16)
  );
  const pick = (s) => s[crypto.randomInt(0, s.length)];
  const chars = [
    pick(CHARSET_UPPER),
    pick(CHARSET_LOWER),
    pick(CHARSET_DIGIT),
    pick(CHARSET_SPECIAL)
  ];
  const all = CHARSET_UPPER + CHARSET_LOWER + CHARSET_DIGIT + CHARSET_SPECIAL;
  while (chars.length < target) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const t = chars[i];
    chars[i] = chars[j];
    chars[j] = t;
  }
  return chars.join('');
};
