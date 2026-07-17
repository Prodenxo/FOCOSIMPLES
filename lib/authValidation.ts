const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(t)) return 'Informe um e-mail válido.';
  return null;
}

export function validateSignupPassword(password: string): string | null {
  if (!password) return 'Informe uma senha.';
  if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  if (password !== confirm) return 'As senhas não coincidem.';
  return null;
}

/** Opcional: nome para exibição (metadata). */
export function validateOptionalDisplayName(name: string): string | null {
  const t = name.trim();
  if (t.length > 120) return 'O nome deve ter no máximo 120 caracteres.';
  return null;
}
