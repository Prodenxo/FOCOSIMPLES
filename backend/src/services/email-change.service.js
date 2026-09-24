import { createHash, randomBytes } from 'node:crypto';
import { query } from '../config/pg.js';
import { env } from '../config/env.js';
import { badRequest, unauthorized } from '../utils/errors.js';
import { sendEmailViaResend } from './email-sender.service.js';

const TOKEN_TTL_HOURS = 24;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

/** Só o hash fica no banco — o token em claro existe apenas no e-mail enviado. */
const hashToken = (rawToken) =>
  createHash('sha256').update(String(rawToken ?? ''), 'utf8').digest('hex');

/** @param {{ query?: Function, sendEmail?: Function }} [deps] — injeção para testes */
const resolveDeps = (deps = {}) => ({
  run: deps.query ?? query,
  sendEmail: deps.sendEmail ?? sendEmailViaResend,
});

export const buildEmailChangeConfirmUrl = (rawToken) => {
  const url = new URL('/confirmar-email', env.FRONTEND_URL);
  url.searchParams.set('token', rawToken);
  return url.toString();
};

const assertEmailAvailable = async (run, email, userId) => {
  const { rows } = await run(
    `SELECT id FROM public.users
     WHERE email = $1 AND id <> $2 AND deleted_at IS NULL
     LIMIT 1`,
    [email, userId],
  );
  if (rows[0]) throw badRequest('Este e-mail já está em uso por outra conta.');
};

const sendConfirmationEmail = async (sendEmail, newEmail, confirmUrl) =>
  sendEmail({
    to: newEmail,
    subject: 'Confirme seu novo e-mail — Foco Simples',
    context: 'email-change',
    html: `
      <p>Olá,</p>
      <p>Recebemos um pedido para passar o acesso da sua conta Foco Simples para este e-mail.</p>
      <p><a href="${confirmUrl}">Clique aqui para confirmar o novo e-mail</a></p>
      <p>O link expira em ${TOKEN_TTL_HOURS} horas. Até confirmar, o e-mail antigo continua valendo.</p>
      <p style="color:#64748b;font-size:12px">Foco Simples</p>
    `.trim(),
  });

/** Aviso no endereço atual — quem perdeu o acesso à conta consegue reagir. */
const notifyCurrentEmail = async (sendEmail, currentEmail, newEmail) => {
  if (!currentEmail) return;
  try {
    await sendEmail({
      to: currentEmail,
      subject: 'Pedido de troca de e-mail na sua conta — Foco Simples',
      context: 'email-change-notice',
      html: `
        <p>Olá,</p>
        <p>Pedimos a confirmação de troca do e-mail desta conta para <strong>${newEmail}</strong>.</p>
        <p>Se foi você, nada a fazer: basta confirmar pelo link enviado ao novo endereço.</p>
        <p>Se <strong>não</strong> foi você, fale com o suporte agora — enquanto o link não for confirmado, este e-mail continua valendo.</p>
        <p style="color:#64748b;font-size:12px">Foco Simples</p>
      `.trim(),
    });
  } catch (error) {
    // Aviso é secundário: não impede a troca de seguir.
    console.warn('[email-change] aviso ao e-mail atual falhou:', error?.message);
  }
};

/**
 * Cria o pedido e envia o link. O e-mail da conta só muda na confirmação.
 * @param {string} userId
 * @param {string} newEmailInput
 * @param {{ query?: Function, sendEmail?: Function }} [deps]
 * @returns {Promise<{ email: string }>}
 */
export const requestLocalEmailChange = async (userId, newEmailInput, deps = {}) => {
  const { run, sendEmail } = resolveDeps(deps);
  if (!userId) throw unauthorized();

  const newEmail = normalizeEmail(newEmailInput);
  if (!newEmail || !EMAIL_PATTERN.test(newEmail)) throw badRequest('E-mail inválido.');

  const { rows: userRows } = await run(
    `SELECT email FROM public.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId],
  );
  if (!userRows[0]) throw badRequest('Usuário não encontrado');

  const currentEmail = userRows[0].email;
  if (normalizeEmail(currentEmail) === newEmail) {
    throw badRequest('Informe um e-mail diferente do atual.');
  }

  await assertEmailAvailable(run, newEmail, userId);

  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Um pedido em aberto por conta: o link anterior deixa de valer.
  await run(
    `DELETE FROM public.email_change_requests
     WHERE user_id = $1 AND confirmed_at IS NULL`,
    [userId],
  );
  await run(
    `INSERT INTO public.email_change_requests (user_id, new_email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, newEmail, hashToken(rawToken), expiresAt],
  );

  await sendConfirmationEmail(sendEmail, newEmail, buildEmailChangeConfirmUrl(rawToken));
  await notifyCurrentEmail(sendEmail, currentEmail, newEmail);

  return { email: newEmail };
};

/**
 * Consome o token do link e passa o login para o novo e-mail.
 * @param {string} rawToken
 * @param {{ query?: Function }} [deps]
 * @returns {Promise<{ email: string }>}
 */
export const confirmLocalEmailChange = async (rawToken, deps = {}) => {
  const { run } = resolveDeps(deps);
  const token = String(rawToken ?? '').trim();
  if (!token) throw badRequest('Link inválido.');

  const { rows } = await run(
    `SELECT id, user_id, new_email
     FROM public.email_change_requests
     WHERE token_hash = $1 AND confirmed_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  );
  const request = rows[0];
  if (!request) {
    throw badRequest('Link inválido ou expirado. Peça a alteração de e-mail de novo.');
  }

  await assertEmailAvailable(run, request.new_email, request.user_id);

  const { rowCount } = await run(
    `UPDATE public.users
     SET email = $2, email_confirmed_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [request.user_id, request.new_email],
  );
  if (!rowCount) throw badRequest('Usuário não encontrado');

  await run(
    `UPDATE public.email_change_requests SET confirmed_at = now() WHERE id = $1`,
    [request.id],
  );

  return { email: request.new_email };
};
