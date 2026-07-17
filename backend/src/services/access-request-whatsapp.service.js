import { env } from '../config/env.js';
import { normalizeWhatsappPhoneDigits } from '../utils/whatsapp-phone.js';
import { normalizeZapiPhone } from './zapi-outbound.service.js';
import {
  getWhatsappOutboundChannel,
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const isTruthy = (value) => String(value || '').toLowerCase() === 'true';

export const isAccessRequestWhatsappNotifyEnabled = () => {
  if (!isTruthy(env.ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED)) return false;
  return isWhatsappOutboundConfigured();
};

const normalizeRoleKey = (role) => {
  if (!role) return null;
  const n = String(role).trim().toLowerCase();
  if (n === 'user') return 'usuario';
  return n || null;
};

/** Telefones extra opcionais (env), além dos superadmins na BD. */
export const getExtraSuperadminNotifyPhones = () => {
  const raw = (
    env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_EXTRA_PHONES
    || env.ACCESS_REQUEST_NOTIFY_SUPERADMIN_PHONE
    || ''
  ).trim();
  if (!raw) return [];
  const phones = [];
  for (const part of raw.split(/[,;]/)) {
    const digits = normalizeWhatsappPhoneDigits(part);
    if (!digits) continue;
    phones.push(normalizeZapiPhone(digits));
  }
  return phones;
};

/**
 * IDs de utilizadores com capacidade superadmin (profiles.role ou vínculo activo).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @returns {Promise<string[]>}
 */
export const collectSuperadminUserIds = async (sb) => {
  const ids = new Set();

  const { data: profileRows, error: profileErr } = await sb
    .from('profiles')
    .select('id, role');
  if (profileErr) throw profileErr;
  for (const row of profileRows || []) {
    if (normalizeRoleKey(row.role) === 'superadmin' && row.id) {
      ids.add(String(row.id));
    }
  }

  const { data: roleRows, error: rolesErr } = await sb.from('roles').select('id, roles');
  if (rolesErr) throw rolesErr;
  const superRoleIds = (roleRows || [])
    .filter((r) => normalizeRoleKey(r.roles) === 'superadmin')
    .map((r) => r.id)
    .filter(Boolean);

  if (superRoleIds.length > 0) {
    const { data: links, error: linksErr } = await sb
      .from('role_x_user_x_empresa')
      .select('user_id')
      .eq('status', true)
      .in('roles_id', superRoleIds);
    if (linksErr) throw linksErr;
    for (const link of links || []) {
      if (link.user_id) ids.add(String(link.user_id));
    }
  }

  return [...ids];
};

/**
 * Telefones WhatsApp de todos os superadmins (único por número).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @returns {Promise<string[]>}
 */
export const collectSuperadminNotifyPhones = async (sb) => {
  const userIds = await collectSuperadminUserIds(sb);
  const phones = new Set(getExtraSuperadminNotifyPhones());

  for (const userId of userIds) {
    const phone = await resolveUserWhatsappPhone(sb, userId, null);
    if (phone) phones.add(phone);
  }

  return [...phones];
};

const firstName = (fullName, email) => {
  const fromName = String(fullName || '').trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = String(email || '').split('@')[0];
  return fromEmail || 'Cliente';
};

const formatCnpjDisplay = (cnpj) => {
  const d = String(cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return d || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/**
 * @param {{
 *   fullName?: string | null,
 *   email?: string | null,
 *   phone?: string | null,
 *   empresaNome?: string | null,
 *   cnpj?: string | null,
 *   observacao?: string | null,
 * }} input
 */
export const buildAccessRequestSubmittedSuperadminMessage = (input) => {
  const lines = [
    '🔔 Nova solicitação de acesso — Meu Financeiro',
    '',
    `Nome: ${input.fullName || '—'}`,
    `E-mail: ${input.email || '—'}`,
    `Telefone: ${input.phone || '—'}`,
    `Empresa: ${input.empresaNome || '—'}`,
    `CNPJ: ${formatCnpjDisplay(input.cnpj)}`,
  ];
  if (input.observacao) {
    lines.push('', `Observação: ${input.observacao}`);
  }
  if (input.email) {
    lines.push(
      '',
      'Para aprovar pelo WhatsApp, responda:',
      `mf aprovar ${input.email}`,
      '',
      'Lista: mf pendentes',
    );
  } else {
    lines.push('', 'Lista: mf pendentes');
  }
  lines.push('', 'Ou no app: Configurações → Solicitações de acesso.');
  return lines.join('\n');
};

const DEFAULT_ACCESS_REQUEST_SUPPORT_GROUP_URL =
  'https://chat.whatsapp.com/G0F3SaEFfvNI066k5MYKDT';

export const getAccessRequestSupportGroupUrl = () => {
  const fromEnv = String(env.ACCESS_REQUEST_WHATSAPP_SUPPORT_GROUP_URL || '').trim();
  return fromEnv || DEFAULT_ACCESS_REQUEST_SUPPORT_GROUP_URL;
};

/**
 * @param {{ fullName?: string | null, email?: string | null }} input
 */
export const buildAccessRequestApprovedApplicantMessage = (input) => {
  const nome = firstName(input.fullName, input.email);
  const groupUrl = getAccessRequestSupportGroupUrl();
  const lines = [
    `Olá, ${nome}! Seu acesso ao Meu Financeiro foi aprovado.`,
    'Já pode entrar na app com seu e-mail e senha cadastrados.',
    '',
    'Entre também no nosso grupo de suporte no WhatsApp:',
    groupUrl,
    '',
    'Qualquer dúvida, estamos por lá.',
  ];
  return lines.join('\n');
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} userId
 * @param {string | null | undefined} fallbackPhone
 */
export const resolveUserWhatsappPhone = async (sb, userId, fallbackPhone) => {
  const { data: link } = await sb
    .from('n8n_link')
    .select('user_number')
    .eq('user_id', userId)
    .maybeSingle();

  let digits = normalizeWhatsappPhoneDigits(link?.user_number);
  if (!digits && fallbackPhone) {
    digits = normalizeWhatsappPhoneDigits(fallbackPhone);
  }
  if (!digits) {
    const { data: authData } = await sb.auth.admin.getUserById(userId);
    const meta = authData?.user?.user_metadata ?? {};
    digits = normalizeWhatsappPhoneDigits(
      meta.phone || authData?.user?.phone || null,
    );
  }
  if (!digits) return '';
  return normalizeZapiPhone(digits);
};

const logNotifyFailure = (kind, err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[access-request-whatsapp] ${kind} falhou:`, msg);
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} userId
 * @param {{ fullName?: string | null, email?: string | null }} profile
 */
export const notifyApplicantAccessApproved = async (sb, userId, profile = {}) => {
  if (!isAccessRequestWhatsappNotifyEnabled()) {
    return { skipped: true, reason: 'disabled_or_whatsapp_not_configured' };
  }

  const phone = await resolveUserWhatsappPhone(sb, userId, null);
  if (!phone) {
    return { skipped: true, reason: 'applicant_phone_missing' };
  }

  const message = buildAccessRequestApprovedApplicantMessage(profile);
  try {
    const result = await sendWhatsappMessage({ phone, message });
    return { sent: true, channel: result.channel || getWhatsappOutboundChannel() };
  } catch (err) {
    logNotifyFailure('approve', err);
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * @param {{
 *   fullName?: string | null,
 *   email?: string | null,
 *   phone?: string | null,
 *   empresaNome?: string | null,
 *   cnpj?: string | null,
 *   observacao?: string | null,
 * }} input
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {Parameters<typeof buildAccessRequestSubmittedSuperadminMessage>[0]} input
 */
export const notifySuperadminAccessRequestSubmitted = async (sb, input) => {
  if (!isAccessRequestWhatsappNotifyEnabled()) {
    return { skipped: true, reason: 'disabled_or_whatsapp_not_configured' };
  }

  let phones = [];
  try {
    phones = await collectSuperadminNotifyPhones(sb);
  } catch (err) {
    logNotifyFailure('submit_list_superadmins', err);
    return { skipped: true, reason: 'superadmin_list_failed' };
  }

  if (!phones.length) {
    return { skipped: true, reason: 'no_superadmin_phones' };
  }

  const message = buildAccessRequestSubmittedSuperadminMessage(input);
  const channel = getWhatsappOutboundChannel();
  const results = await Promise.all(
    phones.map(async (phone) => {
      try {
        await sendWhatsappMessage({ phone, message });
        return { phone, sent: true };
      } catch (err) {
        logNotifyFailure(`submit_${phone}`, err);
        return {
          phone,
          sent: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const sentCount = results.filter((r) => r.sent).length;
  return {
    sent: sentCount > 0,
    sentCount,
    totalTargets: phones.length,
    channel,
    results,
  };
};
