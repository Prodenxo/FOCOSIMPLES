import { env } from '../config/env.js';
import { serviceUnavailable } from '../utils/errors.js';

/**
 * Envio transacional via Resend. O assunto e o HTML ficam com quem chama —
 * aqui só a chamada HTTP e o mapeamento de falha.
 * @param {{ to: string, subject: string, html: string, context?: string }} params
 */
export const sendEmailViaResend = async ({ to, subject, html, context = 'email' }) => {
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
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[${context}] Resend falhou:`, response.status, body.slice(0, 300));
    throw serviceUnavailable('Não foi possível enviar o e-mail. Tente novamente em alguns minutos.');
  }
};
