import { forbidden, badRequest, notFound } from '../utils/errors.js';
import { getServiceRoleClient } from '../config/supabase.js';
import {
  approveAccessRequest,
  findPendingAccessRequestByIdentifier,
  listPendingAccessRequests,
  rejectAccessRequest,
} from './access-request-manage.service.js';

/** Instrução para o agente OpenClaw (não mostrar ao utilizador no WhatsApp). */
export const CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS =
  'Responda ao utilizador APENAS com o texto do campo message desta API. '
  + 'PROIBIDO acrescentar DAS MEI, transações, NFSe, lembretes de pagamento, '
  + 'contas de terceiros ou qualquer outro assunto no mesmo turno. '
  + 'Não chame get_das_current nem outras actions além da de cadastro.';

/**
 * @param {Record<string, unknown>} [extra]
 */
const withCadastroAgentMeta = (extra = {}) => ({
  agentInstructions: CADASTRO_ACCESS_REQUEST_AGENT_INSTRUCTIONS,
  replyScope: 'access_requests_only',
  ...extra,
});

/**
 * @param {{ hasSuperadminCapability?: boolean, profileRole?: string | null }} actorContext
 */
export const assertOpenclawSuperadmin = (actorContext) => {
  if (actorContext?.hasSuperadminCapability || actorContext?.profileRole === 'superadmin') {
    return;
  }
  throw forbidden(
    'Apenas superadmin pode gerir solicitações de cadastro. Use o painel ou uma conta superadmin.',
  );
};

/**
 * @param {Awaited<ReturnType<typeof listPendingAccessRequests>>} pending
 */
export const formatPendingAccessRequestsForOpenclaw = (pending) => {
  if (!pending.length) {
    return 'Não há solicitações de acesso pendentes.';
  }

  const lines = [`${pending.length} solicitação(ões) pendente(s):`, ''];
  pending.forEach((r, i) => {
    const nome = r.fullName || r.email || 'Sem nome';
    lines.push(`${i + 1}. ${nome}`);
    lines.push(`   userId: ${r.userId}`);
    if (r.email) lines.push(`   e-mail: ${r.email}`);
    if (r.phone) lines.push(`   telefone: ${r.phone}`);
    if (r.empresa?.cnpj) lines.push(`   CNPJ: ${r.empresa.cnpj}`);
    if (r.empresa?.nome) lines.push(`   empresa: ${r.empresa.nome}`);
    lines.push('');
  });
  lines.push('Para aprovar: action approve_access_request com payload.email ou userId.');
  return lines.join('\n');
};

/**
 * @param {string} actorUserId
 * @param {{ hasSuperadminCapability?: boolean, profileRole?: string | null }} actorContext
 */
export const openclawListAccessRequests = async (actorUserId, actorContext) => {
  assertOpenclawSuperadmin(actorContext);
  const sb = getServiceRoleClient();
  const pending = await listPendingAccessRequests(sb);
  const summary = formatPendingAccessRequestsForOpenclaw(pending);
  return {
    ok: true,
    message: summary,
    data: withCadastroAgentMeta({
      count: pending.length,
      requests: pending.map((r) => ({
        userId: r.userId,
        email: r.email,
        fullName: r.fullName,
        phone: r.phone,
        empresa: r.empresa,
        requestedAt: r.requestedAt,
      })),
    }),
  };
};

const resolveIdentifierFromPayload = (payload) => {
  const id =
    payload?.userId
    ?? payload?.email
    ?? payload?.cnpj
    ?? payload?.identifier
    ?? payload?.phone;
  if (!id) {
    throw badRequest('Informe payload.userId, payload.email, payload.cnpj ou payload.identifier.');
  }
  return String(id).trim();
};

/**
 * @param {string} actorUserId
 * @param {{ hasSuperadminCapability?: boolean, profileRole?: string | null }} actorContext
 * @param {Record<string, unknown>} payload
 */
export const openclawApproveAccessRequest = async (actorUserId, actorContext, payload) => {
  assertOpenclawSuperadmin(actorContext);
  const identifier = resolveIdentifierFromPayload(payload);
  const sb = getServiceRoleClient();
  const pending = await listPendingAccessRequests(sb);
  const match = findPendingAccessRequestByIdentifier(pending, identifier);
  if (!match) {
    throw notFound(
      'Nenhuma solicitação pendente para esse identificador. Use list_access_requests.',
    );
  }

  const result = await approveAccessRequest({
    actorUserId,
    userId: match.userId,
  });
  if (!result.ok) {
    throw badRequest('Solicitação já não está pendente (pode ter sido aprovada antes).');
  }

  const label = result.fullName || result.email || match.userId;
  return {
    ok: true,
    message: `Cadastro aprovado: ${label}${result.email ? ` (${result.email})` : ''}. O solicitante é notificado no WhatsApp se tiver telefone.`,
    data: withCadastroAgentMeta({
      userId: match.userId,
      email: result.email,
      fullName: result.fullName,
      empresaNome: result.empresaNome,
    }),
  };
};

/**
 * @param {{ hasSuperadminCapability?: boolean, profileRole?: string | null }} actorContext
 * @param {Record<string, unknown>} payload
 */
export const openclawRejectAccessRequest = async (actorContext, payload) => {
  assertOpenclawSuperadmin(actorContext);
  const identifier = resolveIdentifierFromPayload(payload);
  const sb = getServiceRoleClient();
  const pending = await listPendingAccessRequests(sb);
  const match = findPendingAccessRequestByIdentifier(pending, identifier);
  if (!match) {
    throw notFound('Nenhuma solicitação pendente para esse identificador.');
  }

  const result = await rejectAccessRequest({ userId: match.userId });
  if (!result.ok) {
    throw badRequest('Solicitação já não está pendente.');
  }

  const label = match.fullName || match.email || match.userId;
  return {
    ok: true,
    message: `Cadastro recusado e removido: ${label}.`,
    data: withCadastroAgentMeta({ userId: match.userId, email: match.email }),
  };
};
