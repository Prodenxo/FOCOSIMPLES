import { getServiceRoleClient } from '../config/supabase.js';
import { resolveUserIdByPhone } from './openclaw-bot.service.js';
import { sendWhatsappMessage } from './whatsapp-outbound.service.js';
import {
  approveAccessRequest,
  findPendingAccessRequestByIdentifier,
  getUserRole,
  listPendingAccessRequests,
  rejectAccessRequest,
} from './access-request-manage.service.js';
import {
  isAccessManagementCommandMessage,
  toInternalAccessCommandText,
} from './access-request-command-text.service.js';
import { isAccessRequestWhatsappNotifyEnabled } from './access-request-whatsapp.service.js';

/**
 * @param {string} text
 */
export const normalizeAccessRequestCommandInput = (text) => {
  return toInternalAccessCommandText(text);
};

/**
 * @param {string} text
 */
export const isAccessRequestWhatsappCommand = (text) => {
  return isAccessManagementCommandMessage(text);
};

/**
 * @param {string} text
 * @returns {{ action: 'approve' | 'reject' | 'list' | 'help', arg?: string } | null}
 */
export const parseAccessRequestWhatsappCommand = (text) => {
  const t = normalizeAccessRequestCommandInput(text);
  if (!t) return null;

  const approve = /^APROVAR\s+(.+)$/i.exec(t);
  if (approve) return { action: 'approve', arg: approve[1].trim() };

  const reject = /^REJEITAR\s+(.+)$/i.exec(t);
  if (reject) return { action: 'reject', arg: reject[1].trim() };

  if (/^(PENDENTES|LISTAR)$/i.test(t)) {
    return { action: 'list' };
  }

  if (/^(AJUDA|HELP)(\s+ACESSO)?$/i.test(t)) {
    return { action: 'help' };
  }

  return null;
};

export const buildAccessRequestWhatsappHelpMessage = () => (
  'Cadastros (Meu Financeiro):\n\n'
  + '• mf pendentes\n'
  + '• mf aprovar <e-mail ou CNPJ>\n'
  + '• mf rejeitar <e-mail ou CNPJ>\n'
  + '• mf ajuda\n\n'
  + 'Ex.: mf aprovar cliente@email.com'
);

/**
 * @param {Awaited<ReturnType<typeof listPendingAccessRequests>>} pending
 */
export const buildPendingAccessRequestsListMessage = (pending) => {
  if (!pending.length) {
    return 'Não há solicitações de acesso pendentes no momento.';
  }

  const max = 15;
  const slice = pending.slice(0, max);
  const lines = [`Solicitações pendentes (${pending.length}):`, ''];

  slice.forEach((r, i) => {
    const nome = r.fullName || r.email || 'Sem nome';
    const email = r.email || '—';
    const cnpj = r.empresa?.cnpj || '—';
    lines.push(`${i + 1}. ${nome}`);
    lines.push(`   E-mail: ${email}`);
    lines.push(`   CNPJ: ${cnpj}`);
    if (email && email !== '—') {
      lines.push(`   → mf aprovar ${email}`);
    }
    lines.push('');
  });

  if (pending.length > max) {
    lines.push(`… e mais ${pending.length - max}. Use APROVAR <e-mail> para um específico.`);
  }

  lines.push('Comandos: mf pendentes | mf aprovar <e-mail>');
  return lines.join('\n');
};

/**
 * @param {string} phone
 * @param {string} message
 */
const sendReply = async (phone, message) => {
  try {
    await sendWhatsappMessage({ phone, message });
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[access-request-whatsapp-inbound] falha ao enviar WhatsApp:', msg);
    return { sent: false, error: msg };
  }
};

/**
 * Quando o webhook recebe `mf …` mas o handler não corre (env / deploy).
 * @param {string | undefined} reason
 */
export const buildMfCommandNotProcessedMessage = (reason) => {
  if (reason === 'disabled') {
    return (
      'Recebi "mf …" no servidor, mas notificações de cadastro estão desligadas '
      + '(ACCESS_REQUEST_WHATSAPP_NOTIFY_ENABLED). Ative no Easypanel e reinicie o backend.'
    );
  }
  if (reason === 'not_command') {
    return 'Comando mf não reconhecido. Tente: mf pendentes | mf ajuda';
  }
  return (
    'O servidor viu sua mensagem "mf …" mas não concluiu o processamento. '
    + 'Confira logs do backend ou envie mf ajuda.'
  );
};

/**
 * @param {string} phone
 * @param {string | undefined} reason
 */
export const sendMfCommandDiagnosticReply = async (phone, reason) => {
  return sendReply(phone, buildMfCommandNotProcessedMessage(reason));
};

/**
 * Processa comando de superadmin via WhatsApp (Z-API inbound).
 * @param {{ phone: string, text: string }} input
 * @returns {Promise<{ handled: boolean, reason?: string }>}
 */
export const handleAccessRequestWhatsappInbound = async (input) => {
  if (!isAccessRequestWhatsappNotifyEnabled()) {
    return { handled: false, reason: 'disabled' };
  }

  const rawText = String(input.text || '').trim();
  const text = normalizeAccessRequestCommandInput(rawText);
  if (!isAccessRequestWhatsappCommand(rawText)) {
    return { handled: false, reason: 'not_command' };
  }

  const parsed = parseAccessRequestWhatsappCommand(text);
  if (!parsed) {
    await sendReply(
      input.phone,
      'Comando não reconhecido.\n\n' + buildAccessRequestWhatsappHelpMessage(),
    );
    return { handled: true, reason: 'unknown_command' };
  }

  let actorUserId;
  try {
    actorUserId = await resolveUserIdByPhone(input.phone);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[access-request-whatsapp-inbound] lookup telefone:', msg);
    actorUserId = null;
  }

  if (!actorUserId) {
    await sendReply(
      input.phone,
      'Não encontrei seu usuário pelo número do WhatsApp. '
      + 'Abra o app, faça login como superadmin e confira se o telefone está salvo no perfil.',
    );
    return { handled: true, reason: 'actor_not_found' };
  }

  const sb = getServiceRoleClient();
  const role = await getUserRole(sb, actorUserId);
  if (role !== 'superadmin') {
    await sendReply(
      input.phone,
      'Este número não está autorizado a aprovar solicitações. '
      + 'Use uma conta superadmin com telefone cadastrado na app.',
    );
    return { handled: true, reason: 'not_superadmin' };
  }

  if (parsed.action === 'help') {
    await sendReply(input.phone, buildAccessRequestWhatsappHelpMessage());
    return { handled: true, reason: 'help' };
  }

  if (parsed.action === 'list') {
    const pending = await listPendingAccessRequests(sb);
    await sendReply(input.phone, buildPendingAccessRequestsListMessage(pending));
    return { handled: true, reason: 'list' };
  }

  const pending = await listPendingAccessRequests(sb);
  const match = findPendingAccessRequestByIdentifier(pending, parsed.arg || '');

  if (!match) {
    await sendReply(
      input.phone,
      'Não encontrei solicitação pendente para esse identificador.\n'
      + 'Envie PENDENTES para ver a lista ou use o e-mail exato do cadastro.',
    );
    return { handled: true, reason: 'not_found' };
  }

  if (parsed.action === 'approve') {
    const result = await approveAccessRequest({
      actorUserId,
      userId: match.userId,
    });
    if (!result.ok) {
      await sendReply(input.phone, 'Esta solicitação já não está pendente (pode ter sido aprovada antes).');
      return { handled: true, reason: result.reason };
    }
    const label = result.fullName || result.email || 'Cliente';
    await sendReply(
      input.phone,
      `Aprovado: ${label}${result.email ? ` (${result.email})` : ''}.\n`
      + 'O solicitante receberá aviso no WhatsApp (se tiver telefone cadastrado).',
    );
    return { handled: true, reason: 'approved' };
  }

  if (parsed.action === 'reject') {
    const result = await rejectAccessRequest({ userId: match.userId });
    if (!result.ok) {
      await sendReply(input.phone, 'Esta solicitação já não está pendente.');
      return { handled: true, reason: result.reason };
    }
    const label = match.fullName || match.email || 'Cadastro';
    await sendReply(input.phone, `Recusado e removido: ${label}.`);
    return { handled: true, reason: 'rejected' };
  }

  return { handled: false, reason: 'unhandled' };
};
