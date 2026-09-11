const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;

export function validateStrongPassword(password) {
  const p = String(password ?? '').trim();
  if (!p) return { ok: false, message: 'Senha é obrigatória' };
  if (p.length < 8) return { ok: false, message: 'A senha deve ter no mínimo 8 caracteres' };
  if (!/[A-Z]/.test(p)) return { ok: false, message: 'Inclua pelo menos uma letra maiúscula (A-Z)' };
  if (!SPECIAL_RE.test(p)) {
    return { ok: false, message: 'Inclua pelo menos um caractere especial (ex.: ! @ # $ % & *)' };
  }
  return { ok: true };
}

export function strongPasswordRequirementBullets() {
  return [
    'Mínimo de 8 caracteres',
    'Pelo menos uma letra maiúscula (A-Z)',
    'Pelo menos um caractere especial (! @ # $ % & *)',
  ];
}
