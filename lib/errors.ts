/** Mensagem segura para exibir ou logar a partir de valores desconhecidos (catch). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const AUTH_BLOCK_MESSAGES = ['Seu perfil está bloqueado', 'Seu acesso expirou'] as const;

export function isAuthBlockOrExpiryMessage(message: string): boolean {
  return AUTH_BLOCK_MESSAGES.some((m) => message === m);
}

export function isInvalidRefreshTokenMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found') ||
    normalized.includes('refresh_token_not_found')
  );
}

/** Sessão já expirada ou limpa — logout local deve concluir sem erro. */
export function isAuthSessionMissingMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('auth session missing') ||
    normalized.includes('session missing') ||
    normalized.includes('authsessionmissing')
  );
}

export function isBenignSignOutError(message: string): boolean {
  return isInvalidRefreshTokenMessage(message) || isAuthSessionMissingMessage(message);
}

/** Mensagem amigável quando a migration de conta global ainda não foi aplicada no Supabase. */
export function formatContaMoedaGlobalDbError(error: unknown): string {
  const msg = getErrorMessage(error)
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : ''
  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    /contas_moeda_global/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /relation.*does not exist/i.test(msg)
  ) {
    return (
      'A tabela contas_moeda_global ainda não existe no Supabase. ' +
      'Execute a migration Site/supabase/migrations/20260706120000_create_contas_moeda_global.sql ' +
      'no SQL Editor do projeto.'
    )
  }
  return msg
}

/** Mensagem amigável quando a migration de contas ainda não foi aplicada no Supabase. */
export function formatContaFinanceiraDbError(error: unknown): string {
  const msg = getErrorMessage(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  if (
    code === 'PGRST205' ||
    /contas_financeiras/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /relation.*does not exist/i.test(msg)
  ) {
    return (
      'A tabela contas_financeiras ainda não existe no Supabase. ' +
      'Abra o SQL Editor do projeto e execute o arquivo ' +
      'Site/supabase/migrations/CONTAS_FINANCEIRAS_APPLY_MANUAL.sql'
    );
  }
  return msg;
}
