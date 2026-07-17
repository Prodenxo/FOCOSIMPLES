import type { AuthError } from '@supabase/supabase-js';
import { getErrorMessage } from './errors';

/** Mensagens amigáveis em PT-BR para erros comuns do Supabase Auth (sem expor detalhes internos). */
export function getSupabaseAuthMessagePt(error: unknown): string {
  const raw = getErrorMessage(error).trim();
  const lower = raw.toLowerCase();
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as AuthError).code || '') : '';

  if (
    code === 'user_already_exists' ||
    lower.includes('already registered') ||
    lower.includes('user already registered') ||
    lower.includes('email address is already registered')
  ) {
    return 'Este e-mail já está cadastrado. Tente fazer login.';
  }

  if (code === 'weak_password' || lower.includes('password')) {
    if (lower.includes('6') || lower.includes('least')) {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    return 'A senha não atende aos requisitos. Use uma senha mais forte.';
  }

  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.';
  }

  if (lower.includes('invalid email') || code === 'invalid_credentials') {
    return 'Verifique o formato do e-mail e tente novamente.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }

  if (lower.includes('redirect') && lower.includes('url')) {
    return 'URL de recuperação não autorizada. Contate o suporte.';
  }

  if (lower.includes('email') && (lower.includes('send') || lower.includes('smtp'))) {
    return 'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos ou verifique o spam.';
  }

  if (lower.includes('signup') && lower.includes('disabled')) {
    return 'Novos cadastros estão temporariamente indisponíveis. Tente mais tarde.';
  }

  if (raw.length > 0 && raw.length < 200) {
    return raw;
  }

  return 'Não foi possível concluir a operação. Tente novamente.';
}
