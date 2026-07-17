/**
 * Política de senha forte — manter em sincronia com `backend/src/utils/passwordPolicy.js`
 * e Site/frontend/src/lib/passwordPolicy.ts.
 */
export const STRONG_PASSWORD_MIN_LENGTH = 8;
export const STRONG_PASSWORD_MAX_LENGTH = 128;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;

export function validateStrongPassword(
  password: string
): { ok: true } | { ok: false; message: string } {
  const p = String(password ?? '').trim();
  if (!p) {
    return { ok: false, message: 'Senha é obrigatória' };
  }
  if (p.length < STRONG_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres`,
    };
  }
  if (p.length > STRONG_PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no máximo ${STRONG_PASSWORD_MAX_LENGTH} caracteres`,
    };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, message: 'Inclua pelo menos uma letra maiúscula (A-Z)' };
  }
  if (!SPECIAL_RE.test(p)) {
    return {
      ok: false,
      message: 'Inclua pelo menos um caractere especial (ex.: ! @ # $ % & * - _ = + )',
    };
  }
  return { ok: true };
}

/** Texto curto para labels / dicas de formulário */
export function strongPasswordRequirementsSummary(): string {
  return `Mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres, com pelo menos uma maiúscula e um caractere especial.`;
}

export function strongPasswordRequirementBullets(): string[] {
  return [
    `Pelo menos ${STRONG_PASSWORD_MIN_LENGTH} caracteres`,
    'Pelo menos uma letra maiúscula (A-Z)',
    'Pelo menos um caractere especial (! @ # $ % & * …)',
  ];
}
