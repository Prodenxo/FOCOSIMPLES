import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest, serviceUnavailable } from '../utils/errors.js';

const buildRecoveryUrl = (redirectTo, hashedToken) => {
  const url = new URL(redirectTo);
  url.searchParams.set('token_hash', hashedToken);
  url.searchParams.set('type', 'recovery');
  return url.toString();
};

const mapSupabaseRecoveryError = (error) => {
  const message = String(error?.message || 'Falha ao solicitar recuperação de senha');
  const status = Number(error?.status || 0);

  if (status === 429 || /only request this after/i.test(message)) {
    throw badRequest(
      'Aguarde cerca de 1 minuto antes de solicitar outro e-mail de recuperação.',
    );
  }

  if (/redirect.*not allowed|redirect_to/i.test(message)) {
    throw badRequest(
      'Configuração de redirect inválida no Supabase. Inclua https://meiinfinito.com.br/reset-password em Redirect URLs.',
    );
  }

  throw badRequest(message);
};

const sendViaResend = async ({ to, recoveryUrl }) => {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw serviceUnavailable('Envio de e-mail não configurado (RESEND_API_KEY / RESEND_FROM_EMAIL).');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Redefinir sua senha — Mei Infinito',
      html: `
        <p>Olá,</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta no Mei Infinito.</p>
        <p><a href="${recoveryUrl}">Clique aqui para criar uma nova senha</a></p>
        <p>Se você não solicitou, ignore este e-mail. O link expira em cerca de 1 hora.</p>
        <p style="color:#64748b;font-size:12px">Mei Infinito — meiinfinito.com.br</p>
      `.trim(),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[password-reset] Resend falhou:', response.status, body.slice(0, 300));
    throw serviceUnavailable('Não foi possível enviar o e-mail de recuperação. Tente novamente em alguns minutos.');
  }
};

/**
 * Gera link de recovery (admin) e envia via Resend com URL no domínio do app (melhor entrega Hotmail/Outlook).
 */
export const sendPasswordResetEmail = async (email, redirectTo) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw badRequest('Email é obrigatório');
  if (!redirectTo) {
    throw badRequest('FRONTEND_URL não configurado no backend.');
  }

  const admin = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalized,
    options: { redirectTo },
  });

  if (error) {
    console.error('[password-reset] generateLink:', error.message);
    mapSupabaseRecoveryError(error);
  }

  const hashedToken = data?.properties?.hashed_token;
  if (!hashedToken) {
    throw serviceUnavailable('Não foi possível gerar o link de recuperação.');
  }

  const recoveryUrl = buildRecoveryUrl(redirectTo, hashedToken);
  await sendViaResend({ to: normalized, recoveryUrl });
};

export const sendPasswordResetViaSupabase = async (email, redirectTo) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw badRequest('Email é obrigatório');

  const supabase = createSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: redirectTo || undefined,
  });

  if (error) {
    console.error('[password-reset] resetPasswordForEmail:', error.message, error.status);
    mapSupabaseRecoveryError(error);
  }
};
