import { BACKEND_BUILD_ID } from '../build-id.js';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  normalizeWhatsappPhoneDigits,
  isBrazilWhatsappDigits,
} from '../utils/whatsapp-phone.js';
import {
  buildPhoneLookupCandidates,
  collectUserIdsFromN8nLinkCandidates,
  pickPreferredUserIdFromPhoneMatches,
  pickUserIdFromN8nLinkRows,
} from './n8n-link-phone.service.js';

export { buildPhoneLookupCandidates } from './n8n-link-phone.service.js';
import * as transactionsService from './transactions.service.js';
import * as contasFinanceirasService from './contas-financeiras.service.js';
import {
  normalizeOpenclawTransactionPayload,
  normalizeOpenclawTransactionUpdate,
  resolveOpenclawTransactionId,
} from './openclaw-transaction-payload.js';
import * as categoriesService from './categories.service.js';
import * as rbacCatalogService from './rbac-catalog.service.js';
import {
  upsertDasBase64,
} from './mei-guide-das-base64.service.js';
import * as meiGuideService from './mei-guide.service.js';
import { isPeriodoIndisponivelSerproError } from './mei-guide-serpro-period-guard.js';
import * as calendarEventsService from './calendar-events.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';
import {
  buildDasPaymentStatusMessage,
  getDasPaymentStatusForUser,
} from './mei-das.service.js';
import {
  consultOpenclawNfse,
  emitOpenclawNfse,
  fetchOpenclawNfsePdfBase64,
  getOpenclawNfseSetupStatus,
  syncOpenclawNfseEmitente,
  isNfsePdfReadyStatus,
  formatOpenclawNfseProdutosMessage,
  listOpenclawNfseClientes,
  listOpenclawNfseNotas,
  listOpenclawNfseProdutos,
  previewOpenclawNfseEmit,
  registerOpenclawNfseCliente,
  registerOpenclawNfseProduto,
  rethrowNfseErrorForBot,
} from './openclaw-nfse.service.js';
import {
  emitOpenclawNfe,
  formatOpenclawCatalogServicosMessage,
  formatOpenclawNfeProdutosMessage,
  listOpenclawNfeProdutos,
  previewOpenclawNfeEmit,
  registerOpenclawNfeCliente,
  registerOpenclawNfeProduto,
  rethrowNfeErrorForBot,
} from './openclaw-nfe.service.js';
import {
  BOT_NF_CONFIRM_INSTRUCTION,
  BOT_NF_PREVIEW_LOOP_GUARD,
  buildNfConfirmRequestUserMessage,
  buildNfEmittedUserMessage,
} from './openclaw-nf-user-messages.js';
import { formatCnpjDisplay } from '../utils/cpf-cnpj.js';
import { getEmitenteNfseSnapshot } from './mei-certificate-store.js';
import {
  deliverOpenclawNfseWhatsappPdf,
  getOpenclawNfseWhatsappDeliveryState,
  isOpenclawNfseAutoWhatsappEnabled,
  markOpenclawNfseWhatsappSent,
  registerOpenclawNfseWhatsappDelivery,
  scheduleOpenclawNfseWhatsappDeliveryRetries,
} from './nfse-whatsapp-delivery.service.js';
import {
  openclawApproveAccessRequest,
  openclawListAccessRequests,
  openclawRejectAccessRequest,
} from './openclaw-access-requests.service.js';
import {
  assertPayloadNoImpersonation,
  resolveOpenclawCallerPhone,
} from './openclaw-sender-guard.service.js';

const MAX_LIST = 40;

/** Erros de DAS com texto claro para o agente WhatsApp (não pedir CNPJ/certificado no chat). */
const rethrowDasFetchErrorForBot = (err, display) => {
  if (isPeriodoIndisponivelSerproError(err)) {
    throw badRequest(err.message, {
      code: 'MEI_DAS_PERIODO_INDISPONIVEL',
      mes: display,
      botHint:
        'Não há DAS neste mês (ex.: empresa abriu em março → jan/fev sem guia). Não peça CNPJ nem certificado.',
    });
  }
  const code = err?.errors?.code;
  if (code === 'MEI_CERT_MISSING' || code === 'MEI_CERT_LOAD_FAILED') {
    throw badRequest(err.message, {
      code,
      mes: display,
      botHint:
        'Oriente cadastro do certificado A1 na app Meu Financeiro. Proibido pedir certificado ou CNPJ pelo WhatsApp.',
    });
  }
  const msg = String(err?.message || '');
  if (/certificado|CNPJ do MEI/i.test(msg)) {
    throw badRequest(
      `DAS ${display}: conta identificada pelo telefone WhatsApp — não peça certificado nem CNPJ. Se o mês for anterior à abertura do MEI, explique que não existe DAS nesse período.`,
      {
        code: 'MEI_DAS_USE_APP_OR_PERIOD',
        mes: display,
        botHint: 'Repita a message da API; use mf-das-send.sh com o telefone do remetente.',
      }
    );
  }
  throw err;
};

/**
 * Competência no formato MM/YYYY (ex.: 05/2026). Mês pode ter 1 ou 2 dígitos.
 * @param {string} raw
 * @returns {{ display: string, periodoDigits: string } | null}
 */
export const parseMesCompetenciaMmYyyy = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12) return null;
  const display = `${String(month).padStart(2, '0')}/${year}`;
  const periodoDigits = `${year}${String(month).padStart(2, '0')}`;
  return { display, periodoDigits };
};

/** Mês/ano calendário em America/Sao_Paulo (1–12). */
export const brCalendarMonthYear = (refDate = new Date()) => {
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
};

/** Competência calendário actual (UTC) em MM/YYYY — uso legado; DAS em aberto usa mesCompetenciaDasVencimentoDia20. */
export const mesCompetenciaAtualUtc = () => {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const display = `${String(month).padStart(2, '0')}/${year}`;
  const periodoDigits = `${year}${String(month).padStart(2, '0')}`;
  return { display, periodoDigits };
};

/**
 * DAS MEI: vence dia 20 do mês M → competência = mês anterior (M-1).
 * Ex.: em 09/06/2026 o DAS do vencimento 20/06 é competência 05/2026.
 */
export const mesCompetenciaDasVencimentoDia20 = (refDate = new Date()) => {
  const { year, month } = brCalendarMonthYear(refDate);
  let compMonth = month - 1;
  let compYear = year;
  if (compMonth < 1) {
    compMonth = 12;
    compYear -= 1;
  }
  const display = `${String(compMonth).padStart(2, '0')}/${compYear}`;
  const periodoDigits = `${compYear}${String(compMonth).padStart(2, '0')}`;
  const vencimentoDisplay = `20/${String(month).padStart(2, '0')}/${year}`;
  return {
    display,
    periodoDigits,
    vencimentoDisplay,
    vencimentoMes: month,
    vencimentoAno: year,
  };
};

const isTruthyPayloadFlag = (value) =>
  value === true || String(value || '').toLowerCase() === 'true' || value === 1;

/**
 * Resolve competência DAS a partir do payload OpenClaw.
 * Sem mes: DAS em aberto (vencimento dia 20 do mês corrente → competência anterior).
 */
export const resolveDasCompetenciaFromPayload = (payload = {}, refDate = new Date()) => {
  const rawMes = payload?.mes;
  if (rawMes !== undefined && rawMes !== null && String(rawMes).trim() !== '') {
    const competencia = parseMesCompetenciaMmYyyy(rawMes);
    if (!competencia) {
      throw badRequest('mes inválido; use MM/YYYY, ex.: 05/2026');
    }
    return { ...competencia, resolvedBy: 'explicit_mes' };
  }
  if (isTruthyPayloadFlag(payload?.mesCalendarioAtual)) {
    const cal = mesCompetenciaAtualUtc();
    return { ...cal, resolvedBy: 'calendario_atual' };
  }
  const venc = mesCompetenciaDasVencimentoDia20(refDate);
  return { ...venc, resolvedBy: 'vencimento_dia_20' };
};

/** Telefone destino WhatsApp a partir do lookup OpenClaw / `n8n_link`. */
export const resolveOpenclawWhatsappPhone = (phoneDigits, matchedUserNumber) => {
  const matched = normalizeWhatsappPhoneDigits(matchedUserNumber || '');
  if (matched) return matched;

  const raw = normalizeWhatsappPhoneDigits(phoneDigits || '');
  if (!raw) return '';
  if (!isBrazilWhatsappDigits(raw)) return raw;
  if (raw.startsWith('55')) return raw;
  return `55${raw}`;
};

/**
 * Envia PDF via Z-API / n8n. Não lança: devolve status para resposta curta ao agente.
 * @returns {Promise<{ whatsappStatus: string, whatsappError?: string, hint?: string }>}
 */
export const trySendWhatsappPdfOutbound = async ({
  phone,
  pdfBase64,
  fileName,
  message,
  extraPayload = {},
}) => {
  if (!isWhatsappOutboundConfigured()) {
    return {
      whatsappStatus: 'skipped_no_whatsapp',
      hint:
        'Configure ZAPI no backend ou use mf-nfse-send.sh / mf-das-send.sh no OpenClaw (openclaw message send).',
    };
  }
  if (!phone) {
    return { whatsappStatus: 'skipped_no_phone' };
  }
  if (!pdfBase64) {
    return { whatsappStatus: 'skipped_no_pdf' };
  }
  try {
    await sendWhatsappMessage({
      phone,
      fileName,
      pdfBase64,
      message,
      source: 'openclaw_bot',
      ...extraPayload,
    });
    return { whatsappStatus: 'sent' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { whatsappStatus: 'failed', whatsappError: msg };
  }
};

/** Envia DAS via webhook n8n/Z-API. */
export const trySendDasWhatsappWebhook = async ({
  userId,
  phone,
  display,
  periodoDigits,
  pdfBase64,
  fileName,
}) => {
  const year = periodoDigits.slice(0, 4);
  const month = periodoDigits.slice(4, 6);
  return trySendWhatsappPdfOutbound({
    phone,
    pdfBase64,
    fileName,
    message: `Segue o DAS MEI da competência ${display}.`,
    extraPayload: {
      userId,
      competencia: `${year}-${month}`,
      periodoApuracao: periodoDigits,
    },
  });
};

const buildNfseSendExecCommand = (destinationPhone, notaId) => {
  if (!destinationPhone || !notaId) return null;
  return `/home/node/.openclaw/workspace/mf-nfse-send.sh ${destinationPhone} ${notaId}`;
};

/**
 * Resolve telefone → user_id e devolve metadados para diagnóstico (OpenClaw / n8n).
 * @returns {{ userId: string | null, phoneDigits: string, matchedUserNumber: string | null, lookupCandidates: string[] }}
 */
export const resolveUserIdByPhoneDetailed = async (rawPhone) => {
  const phoneDigits = normalizeWhatsappPhoneDigits(rawPhone);
  if (!phoneDigits) {
    throw badRequest('Telefone ausente ou inválido');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }
  const admin = createSupabaseClient({ useServiceRole: true });
  const lookupCandidates = buildPhoneLookupCandidates(phoneDigits);
  const matches = await collectUserIdsFromN8nLinkCandidates(admin, lookupCandidates);
  const userIds = [...matches.keys()];

  if (userIds.length === 0) {
    return {
      userId: null,
      phoneDigits,
      matchedUserNumber: null,
      lookupCandidates,
    };
  }

  if (userIds.length === 1) {
    const userId = userIds[0];
    return {
      userId,
      phoneDigits,
      matchedUserNumber: matches.get(userId) || null,
      lookupCandidates,
    };
  }

  const preferredUserId = await pickPreferredUserIdFromPhoneMatches(admin, userIds);
  if (!preferredUserId) {
    const sampleNumber = matches.get(userIds[0]) || phoneDigits;
    const rows = userIds.map((id) => ({ user_id: id }));
    pickUserIdFromN8nLinkRows(rows, sampleNumber);
  }

  if (userIds.length > 1) {
    // eslint-disable-next-line no-console
    console.warn(
      '[OpenClaw] WhatsApp em várias contas; usando conta preferida',
      JSON.stringify({ phoneDigits, userIds, preferredUserId }),
    );
  }

  return {
    userId: preferredUserId,
    phoneDigits,
    matchedUserNumber: matches.get(preferredUserId) || null,
    lookupCandidates,
    ambiguousResolvedFrom: userIds,
  };
};

export const resolveUserIdByPhone = async (rawPhone) => {
  const r = await resolveUserIdByPhoneDetailed(rawPhone);
  return r.userId;
};

/**
 * Nome/empresa para o agente confirmar que o DAS é da conta certa (não confundir utilizadores).
 * @param {string} userId
 */
export const fetchOpenclawAccountSummary = async (userId) => {
  const admin = createSupabaseClient({ useServiceRole: true });

  let email = null;
  let displayName = null;
  try {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (!authErr && authData?.user) {
      email = authData.user.email ?? null;
      const meta = authData.user.user_metadata || {};
      displayName = meta.display_name || meta.full_name || email || null;
    }
  } catch {
    /* auth opcional */
  }

  let empresaNome = null;
  try {
    const actorCtx = await resolveActorMembershipsForUser(userId);
    empresaNome =
      actorCtx.memberships?.find((m) => m.empresaNome)?.empresaNome ?? null;
  } catch {
    /* memberships opcional */
  }

  let meiCertificadoRazaoSocial = null;
  let meiCertificadoCnpj = null;
  try {
    const emitente = await getEmitenteNfseSnapshot(userId);
    meiCertificadoRazaoSocial = String(
      emitente?.razaoSocial || emitente?.nomeFantasia || '',
    ).trim() || null;
    const cnpjDigits = String(emitente?.certDocument || '').replace(/\D/g, '');
    meiCertificadoCnpj = cnpjDigits.length === 14 ? cnpjDigits : null;
  } catch {
    /* certificado opcional */
  }

  const dasOwnerLabel = meiCertificadoRazaoSocial
    ? (meiCertificadoCnpj
      ? `${meiCertificadoRazaoSocial} (CNPJ ${formatCnpjDisplay(meiCertificadoCnpj)})`
      : meiCertificadoRazaoSocial)
    : null;

  return {
    userId,
    displayName: String(displayName || '').trim() || 'Utilizador',
    empresaNome,
    email,
    meiCertificadoRazaoSocial,
    meiCertificadoCnpj,
    dasOwnerLabel,
  };
};

/**
 * Admin/superadmin pode ver DAS de outro telefone; utilizador comum só a própria conta.
 */
export const assertActorCanAccessDasForUser = async ({
  actorUserId,
  actorContext,
  targetUserId,
}) => {
  if (actorUserId === targetUserId) return;

  const isSuperadmin = Boolean(actorContext?.hasSuperadminCapability);
  const isAdmin =
    actorContext?.profileRole === 'admin' ||
    (actorContext?.memberships || []).some((m) => m.role === 'admin');

  if (isSuperadmin) return;

  if (!isAdmin) {
    throw forbidden(
      'Só podes consultar ou enviar o DAS da tua própria conta. Usa no JSON o telefone WhatsApp de quem está a escrever (remetente do chat), não de outra pessoa.',
    );
  }

  let targetCtx;
  try {
    targetCtx = await resolveActorMembershipsForUser(targetUserId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw forbidden(`Não foi possível validar o colaborador: ${msg}`);
  }

  const adminEmpresaIds = new Set(
    (actorContext?.memberships || [])
      .filter((m) => m.role === 'admin' && m.empresaId)
      .map((m) => String(m.empresaId)),
  );
  const shared = (targetCtx?.memberships || []).some(
    (m) => m.empresaId && adminEmpresaIds.has(String(m.empresaId)),
  );
  if (!shared) {
    throw forbidden(
      'Como administrador, só podes aceder ao DAS de colaboradores da mesma empresa. Usa subjectPhone só após confirmar empresa.',
    );
  }
};

/**
 * Quem pediu o DAS (phone no body) vs de quem é o PDF (subjectPhone opcional).
 * @returns {Promise<{ dataUserId: string, account: object, dataLinkDebug: object, accessedAsSelf: boolean }>}
 */
export const resolveDasDataSubject = async ({
  actorUserId,
  actorContext,
  actorLinkDebug,
  payload,
}) => {
  const subjectRaw =
    payload?.subjectPhone ?? payload?.targetPhone ?? payload?.phoneAlvo ?? null;
  const subjectTrim = subjectRaw === null || subjectRaw === undefined
    ? ''
    : String(subjectRaw).trim();

  if (!subjectTrim) {
    const account = await fetchOpenclawAccountSummary(actorUserId);
    return {
      dataUserId: actorUserId,
      account,
      dataLinkDebug: actorLinkDebug,
      accessedAsSelf: true,
    };
  }

  const subResolved = await resolveUserIdByPhoneDetailed(subjectTrim);
  if (!subResolved.userId) {
    throw notFound(
      'Telefone indicado (subjectPhone) sem utilizador na app. O colaborador deve guardar o telefone no perfil.',
    );
  }

  await assertActorCanAccessDasForUser({
    actorUserId,
    actorContext,
    targetUserId: subResolved.userId,
  });

  const account = await fetchOpenclawAccountSummary(subResolved.userId);
  return {
    dataUserId: subResolved.userId,
    account,
    dataLinkDebug: {
      subjectPhoneDigits: subResolved.phoneDigits,
      subjectMatchedUserNumber: subResolved.matchedUserNumber,
      actorPhoneDigits: actorLinkDebug.phoneDigits,
      actorMatchedUserNumber: actorLinkDebug.matchedUserNumber,
    },
    accessedAsSelf: false,
  };
};

const normalizeOpenclawRoleLabel = (role) => {
  if (!role) return null;
  const n = String(role).trim().toLowerCase().replace(/\s+/g, '');
  if (n === 'user') return 'usuario';
  return n;
};

/**
 * Vínculos activos empresa × role + `profiles.role` (igual fallback de `getRequesterContext` na app).
 * Superadmin pode existir só em `profiles.role` sem linha activa coerente em `role_x_user_x_empresa`.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   memberships: Array<{ linkId: string, role: string | null, empresaId: string | null, empresaNome: string | null, mei: boolean | null }>,
 *   hasActiveMembership: boolean,
 *   profileRole: string | null,
 *   hasSuperadminCapability: boolean
 * }>}
 */
export const resolveActorMembershipsForUser = async (userId) => {
  const admin = createSupabaseClient({ useServiceRole: true });

  const [{ data: links, error }, { data: profileRow, error: profileErr }] = await Promise.all([
    admin
      .from('role_x_user_x_empresa')
      .select('id, empresas_id, roles_id, mei')
      .eq('user_id', userId)
      .eq('status', true),
    admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
  ]);

  if (error) throw badRequest(error.message);
  if (profileErr) throw badRequest(profileErr.message);

  const profileRole = normalizeOpenclawRoleLabel(profileRow?.role);

  if (!links?.length) {
    return {
      memberships: [],
      hasActiveMembership: false,
      profileRole,
      hasSuperadminCapability: profileRole === 'superadmin',
    };
  }

  const roleIds = [...new Set(links.map((l) => l.roles_id).filter(Boolean))];
  const empresaIds = [...new Set(links.map((l) => l.empresas_id).filter(Boolean))];

  /** @type {Map<string, string | null>} */
  let roleMap = new Map();
  if (roleIds.length > 0) {
    const { data: rolesRows, error: rErr } = await admin
      .from('roles')
      .select('id, roles')
      .in('id', roleIds);
    if (rErr) throw badRequest(rErr.message);
    roleMap = new Map(
      (rolesRows || []).map((r) => [r.id, normalizeOpenclawRoleLabel(r.roles)]),
    );
  }

  /** @type {Map<string, string | null>} */
  let empresaMap = new Map();
  if (empresaIds.length > 0) {
    const { data: empRows, error: eErr } = await admin
      .from('empresas')
      .select('id, empresa')
      .in('id', empresaIds);
    if (eErr) throw badRequest(eErr.message);
    empresaMap = new Map((empRows || []).map((e) => [e.id, e.empresa ?? null]));
  }

  const memberships = links.map((link) => ({
    linkId: String(link.id),
    role: link.roles_id ? roleMap.get(link.roles_id) ?? null : null,
    empresaId: link.empresas_id ? String(link.empresas_id) : null,
    empresaNome: link.empresas_id ? empresaMap.get(link.empresas_id) ?? null : null,
    mei: typeof link.mei === 'boolean' ? link.mei : null,
  }));

  const hasSuperadminCapability =
    profileRole === 'superadmin' || memberships.some((m) => m.role === 'superadmin');

  return { memberships, hasActiveMembership: true, profileRole, hasSuperadminCapability };
};

const resolveCatalogDocumentType = (payload = {}) => {
  const raw = String(payload?.documentType || payload?.tipo || payload?.type || '').trim().toUpperCase();
  if (['NFE', 'NF-E', 'PRODUTO', 'PRODUTOS', 'PRODUCT', 'PRODUCTS'].includes(raw)) return 'NFE';
  if (['NFSE', 'NFS-E', 'SERVICO', 'SERVICOS', 'SERVICE', 'SERVICES'].includes(raw)) return 'NFSE';
  return undefined;
};

/**
 * @param {{ phone?: string, senderPhone?: string, action: string, payload?: object }} input
 */
export const runOpenclawAction = async (input) => {
  const actionAliases = {
    proximo_compromisso: 'get_next_calendar_event',
    next_calendar_event: 'get_next_calendar_event',
    depois_dela: 'get_next_calendar_event',
    depois_dele: 'get_next_calendar_event',
    depois_compromisso: 'get_next_calendar_event',
    e_a_proxima: 'get_next_calendar_event',
    e_o_proximo: 'get_next_calendar_event',
    proximos_compromissos: 'list_upcoming_calendar_events',
    proximos_compromissos_hoje: 'list_upcoming_calendar_events',
    list_upcoming_calendar_events: 'list_upcoming_calendar_events',
    excluir_compromisso: 'delete_calendar_event',
    cancelar_reuniao: 'delete_calendar_event',
    delete_calendar_event: 'delete_calendar_event',
    add_calendar_event_meet: 'add_calendar_event_meet',
    gerar_link_reuniao: 'add_calendar_event_meet',
    gerar_meet: 'add_calendar_event_meet',
    send_das_whatsapp: 'send_das_whatsapp',
    enviar_das: 'send_das_whatsapp',
    pdf_das: 'send_das_whatsapp',
    mandar_das: 'send_das_whatsapp',
    pedir_das: 'send_das_whatsapp',
    das_pdf: 'send_das_whatsapp',
    register_nfse_cliente: 'register_nfse_cliente',
    cadastrar_cliente_nfse: 'register_nfse_cliente',
    lookup_nfse_cliente: 'list_nfse_clientes',
    list_nfse_produtos: 'list_nfse_produtos',
    list_nfse_servicos: 'list_nfse_produtos',
    lookup_nfse_produto: 'list_nfse_produtos',
    register_nfse_produto: 'register_nfse_produto',
    cadastrar_produto_nfse: 'register_nfse_produto',
    cadastrar_servico_nfse: 'register_nfse_produto',
    list_nfe_produtos: 'list_nfe_produtos',
    list_catalog_produtos: 'list_nfe_produtos',
    list_catalog_servicos: 'list_catalog_servicos',
    listar_produtos_nfe: 'list_nfe_produtos',
    listar_servicos_nfse: 'list_catalog_servicos',
    register_nfe_cliente: 'register_nfe_cliente',
    cadastrar_cliente_nfe: 'register_nfe_cliente',
    register_nfe_produto: 'register_nfe_produto',
    cadastrar_produto_nfe: 'register_nfe_produto',
    preview_nfe: 'preview_nfe',
    emit_nfe: 'emit_nfe',
    emitir_nfe: 'emit_nfe',
    nota_produto: 'emit_nfe',
    minha_agenda: 'list_calendar_events',
    compromissos_agenda: 'list_calendar_events',
    agenda_compromissos: 'list_calendar_events',
    minha_agenda_hoje: 'list_agenda_checklist_today',
    agenda_hoje: 'list_agenda_checklist_today',
    tarefas_hoje: 'list_agenda_checklist_today',
    checklist_agenda: 'list_agenda_checklist_today',
    feito: 'complete_calendar_event',
    concluir: 'complete_calendar_event',
    concluir_compromisso: 'complete_calendar_event',
    marcar_concluido: 'complete_calendar_event',
    conclui_compromisso: 'complete_calendar_event',
    complete_calendar_event: 'complete_calendar_event',
  };
  let action = String(input?.action || '').trim();
  const rawAction = action;
  action = actionAliases[action] || action;
  let payload = input?.payload && typeof input.payload === 'object' ? { ...input.payload } : {};
  if (
    action === 'list_calendar_events'
    && ['minha_agenda', 'compromissos_agenda', 'agenda_compromissos'].includes(rawAction)
    && !payload.scope
  ) {
    payload = { scope: 'agenda', ...payload };
  }
  if (
    action === 'list_upcoming_calendar_events'
    && !payload.data
    && !payload.date
  ) {
    payload = { data: 'hoje', ...payload };
  }
  if (action === 'get_next_calendar_event') {
    const hasSkipHint = payload.skipCount != null
      || payload.pular != null
      || payload.afterEventId
      || payload.depoisEventId;
    if (
      ['depois_dela', 'depois_dele', 'depois_compromisso'].includes(rawAction)
      && !hasSkipHint
    ) {
      payload = { ...payload, skipCount: 1 };
    }
    if (
      ['e_a_proxima', 'e_o_proximo'].includes(rawAction)
      && !hasSkipHint
    ) {
      payload = { ...payload, skipCount: 2 };
    }
  }

  if (!action) throw badRequest('action é obrigatório');

  let phone = input?.phone;

  if (action !== 'ping') {
    const caller = resolveOpenclawCallerPhone({
      bodyPhone: phone,
      senderPhone: input?.senderPhone,
    });
    phone = caller.phone;
    assertPayloadNoImpersonation(payload, phone, action);
  }

  if (action === 'ping') {
    return {
      ok: true,
      message: 'OpenClaw online',
      data: { pong: true, buildId: BACKEND_BUILD_ID },
    };
  }

  if (action === 'list_roles') {
    const includeDb =
      payload?.includeDatabase === true ||
      String(payload?.includeDatabase || '').toLowerCase() === 'true';
    let databaseRoles = [];
    if (includeDb) {
      try {
        databaseRoles = await rbacCatalogService.listRolesFromDatabase();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        databaseRoles = { error: msg };
      }
    }
    const base = {
      catalog: rbacCatalogService.listRolesCatalog(),
      databaseRoles,
    };
    const phoneDigits = phone ? normalizeWhatsappPhoneDigits(phone) : '';
    if (!phoneDigits) {
      return {
        ok: true,
        message: 'Catálogo de cargos (OpenClaw autorizado)',
        data: { ...base, actorContext: null },
      };
    }
    try {
      const resolved = await resolveUserIdByPhoneDetailed(phone);
      const { userId, matchedUserNumber, lookupCandidates } = resolved;
      const linkDebug = {
        phoneDigits: resolved.phoneDigits,
        matchedUserNumber,
        lookupCandidates,
      };
      if (!userId) {
        return {
          ok: true,
          message:
            'Catálogo de cargos. Telefone ainda sem utilizador na app (n8n_link).',
          data: { ...base, ...linkDebug, actorContext: null },
        };
      }
      let actorContext = {
        memberships: [],
        hasActiveMembership: false,
        profileRole: null,
        hasSuperadminCapability: false,
      };
      try {
        actorContext = await resolveActorMembershipsForUser(userId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[OpenClaw] actorContext list_roles:', msg);
      }
      return {
        ok: true,
        message: 'Catálogo de cargos e cargo do utilizador',
        data: { ...base, userId, actorContext, ...linkDebug },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: true,
        message: 'Catálogo de cargos',
        data: { ...base, actorContext: null, resolveNote: msg },
      };
    }
  }

  const resolved = await resolveUserIdByPhoneDetailed(phone);
  const { userId, phoneDigits, matchedUserNumber, lookupCandidates } = resolved;
  if (!userId) {
    throw notFound(
      'Este WhatsApp ainda não está ligado ao Meu Financeiro. '
      + 'Abra a app → Perfil → guarde este número (com DDD 55) e tente de novo.',
      {
        code: 'PHONE_NOT_LINKED',
        phoneDigits,
        lookupCandidates,
        botHint:
          'Repita esta message UMA vez — não insista na mesma conversa. '
          + 'mf-curl: 1º argumento = telefone do remetente no PAINEL OpenClaw (não o que o utilizador digitar). '
          + 'Se pedirem saldo/DAS antes de vincular, não invente valores.',
      },
    );
  }

  const linkDebug = { phoneDigits, matchedUserNumber, lookupCandidates };

  /** Nunca bloquear Midas/OpenClaw se memberships falharem (schema, rede, Supabase). */
  let actorContext = {
    memberships: [],
    hasActiveMembership: false,
    profileRole: null,
    hasSuperadminCapability: false,
  };
  try {
    actorContext = await resolveActorMembershipsForUser(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OpenClaw] actorContext ignorado (action continua):', msg);
  }

  if (action === 'resolve_user') {
    const account = await fetchOpenclawAccountSummary(userId);
    return {
      ok: true,
      message: `Conta ligada a este telefone: ${account.displayName}${account.empresaNome ? ` (${account.empresaNome})` : ''}.`,
      data: { userId, account, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_access_requests') {
    const result = await openclawListAccessRequests(userId, actorContext);
    return { ...result, data: { ...result.data, actorContext, ...linkDebug } };
  }

  if (action === 'approve_access_request') {
    const result = await openclawApproveAccessRequest(userId, actorContext, payload);
    return { ...result, data: { ...result.data, actorContext, ...linkDebug } };
  }

  if (action === 'reject_access_request') {
    const result = await openclawRejectAccessRequest(actorContext, payload);
    return { ...result, data: { ...result.data, actorContext, ...linkDebug } };
  }

  if (action === 'get_permissions') {
    const roleRaw = payload?.role ?? payload?.cargo;
    const data = roleRaw
      ? rbacCatalogService.getPermissionsForRole(String(roleRaw))
      : rbacCatalogService.resolveEffectivePermissionsForActor(actorContext);
    return {
      ok: true,
      message: roleRaw ? 'Permissões do cargo' : 'Permissões efectivas do utilizador',
      data: { ...data, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'check_permission') {
    const permission = payload?.permission ?? payload?.key;
    if (!permission) {
      throw badRequest('payload.permission (ou key) é obrigatório');
    }
    const check = rbacCatalogService.checkActorPermission(actorContext, String(permission));
    return {
      ok: true,
      message: check.allowed ? 'Permitido' : 'Não permitido',
      data: { ...check, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_contas' || action === 'get_saldo') {
    const summary = await contasFinanceirasService.listContasWithSaldo(userId);
    const filterPayload = action === 'get_saldo' ? payload : {};
    const filtered =
      action === 'get_saldo'
        ? await contasFinanceirasService.getSaldoResumo(userId, filterPayload)
        : summary;
    const contas = filtered.contas ?? summary.contas;
    const totalSaldo = filtered.totalSaldo ?? summary.totalSaldo;
    const saldoSemConta = filtered.saldoSemConta ?? summary.saldoSemConta ?? 0;
    const defaultNome = filtered.defaultContaNome ?? summary.defaultContaNome;
    const saldoMessage =
      action === 'get_saldo'
        ? contasFinanceirasService.formatGetSaldoMessage(
          { contas, totalSaldo, saldoSemConta },
          { filtered: Boolean(filtered.filtered) },
        )
        : null;
    return {
      ok: true,
      message:
        action === 'get_saldo'
          ? saldoMessage
          : `Carteiras activas (${contas.length}). Padrão: ${defaultNome || 'nenhuma'}. Saldo total R$ ${totalSaldo.toFixed(2).replace('.', ',')}.`,
      data: {
        contas,
        totalSaldo,
        saldoSemConta,
        filtered: Boolean(filtered.filtered),
        defaultContaId: filtered.defaultContaId ?? summary.defaultContaId,
        defaultContaNome: defaultNome,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Carteiras: create_conta, update_conta, delete_conta. '
          + 'Lançamentos: create_transaction, update_transaction, delete_transaction. '
          + 'Saldo: get_saldo **sem** payload para saldo geral/todas as contas; com payload.carteira/conta_nome só para uma carteira (ex.: Itaú, Nubank). '
          + 'Em pedido de saldo geral, repete o campo **message** com o detalhe de **cada** carteira — não cites só a padrão. '
          + 'Em create_transaction use payload.carteira ou conta_nome com o nome EXACTO de uma linha abaixo '
          + `(ex.: Nubank, Poupança). Com **2+ carteiras** e pedido sem destino → **pergunte** qual usar (não assuma padrão). `
          + 'Com **1 carteira** pode lançar sem perguntar. '
          + 'Gastos/receitas já realizados: status **pago** (saída) ou **recebido** (entrada) — nunca **pendente**. '
          + 'Se o utilizador mencionar banco/carteira no pedido, OBRIGATÓRIO incluir carteira no JSON — '
          + 'nunca assumir só a padrão quando ele pediu outra.',
      },
    };
  }

  if (action === 'create_conta') {
    const created = await contasFinanceirasService.createContaFinanceira(userId, payload);
    return {
      ok: true,
      message: `Carteira "${created.nome}" criada`,
      data: { conta: created, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'update_conta') {
    const updated = await contasFinanceirasService.updateContaFinanceira(userId, payload);
    return {
      ok: true,
      message: `Carteira "${updated.nome}" actualizada`,
      data: { conta: updated, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'delete_conta') {
    const removed = await contasFinanceirasService.deleteContaFinanceira(userId, payload);
    return {
      ok: true,
      message: `Carteira "${removed.nome}" desactivada`,
      data: { conta: removed, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_transactions') {
    const rows = await transactionsService.listTransactions(userId);
    const sliced = (rows || []).slice(0, MAX_LIST);
    return {
      ok: true,
      message: `Últimas ${sliced.length} transações (máx. ${MAX_LIST}).`,
      data: { transactions: sliced, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_categories') {
    const tipoRaw = payload?.tipo ?? payload?.type;
    const tipo =
      tipoRaw !== undefined && tipoRaw !== null && String(tipoRaw).trim() !== ''
        ? String(tipoRaw).trim()
        : undefined;
    const minimal =
      payload?.minimal === true ||
      String(payload?.minimal || '').toLowerCase() === 'true' ||
      payload?.minimal === 1 ||
      String(payload?.minimal || '').toLowerCase() === '1';

    const rows = await categoriesService.listCategories(userId, tipo);
    const categories = minimal
      ? categoriesService.mapCategoriesToMinimalRows(rows)
      : rows;

    return {
      ok: true,
      message: `Lista de categorias (${categories.length}).`,
      data: {
        categories,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Formate nomes para o utilizador (entrada/saída). Nunca diga "problemas técnicos" — '
          + 'estes dados já vieram da app. Para lançamento use o nome exacto em classificacao. '
          + 'Carteira (Nubank, Poupança, etc.) é campo separado: list_contas → payload.carteira em create_transaction. '
          + 'Status: pago (saída) ou recebido (entrada) para movimentos já feitos.',
      },
    };
  }

  if (action === 'create_transaction') {
    const account = await fetchOpenclawAccountSummary(userId);
    const allCategories = await categoriesService.listCategories(userId);
    const contas = await transactionsService.listActiveContasFinanceiras(userId);
    let normalized;
    try {
      normalized = normalizeOpenclawTransactionPayload(payload, {
        categories: allCategories,
        contas,
      });
    } catch (err) {
      if (err?.errors?.code === 'CARTEIRA_ESCOLHA_OBRIGATORIA') {
        const nomes = (err.errors.contas || contas)
          .map((c) => c?.nome)
          .filter(Boolean);
        const lista = nomes.length ? nomes.join(', ') : 'carteiras da conta';
        return {
          ok: false,
          message:
            `Várias carteiras activas (${lista}). Pergunte em qual lançar antes de registar.`,
          data: {
            userId,
            account,
            actorContext,
            contas: err.errors.contas || contas,
            ...linkDebug,
            agentInstructions:
              `${err.errors.botHint || ''} Chame list_contas, mostre a lista numerada e aguarde a resposta. `
              + 'Depois repita create_transaction com payload.carteira. '
              + 'Status: pago (saída) ou recebido (entrada) — nunca pendente para gastos já feitos.',
          },
        };
      }
      throw err;
    }
    const statusNorm = transactionsService.normalizeTransactionStatus(
      normalized.tipo,
      normalized.status,
    );
    const created = await transactionsService.createTransaction(userId, {
      ...normalized,
      status: statusNorm,
    });
    const statusLabel =
      statusNorm === 'recebido' || statusNorm === 'pago' ? ' (já contabiliza no saldo)' : '';
    const accountLabel = account.displayName || account.email || userId;
    // eslint-disable-next-line no-console
    console.info(
      '[OpenClaw] create_transaction',
      JSON.stringify({
        phoneDigits,
        matchedUserNumber,
        userId,
        account: accountLabel,
        valor: normalized.valor,
        classificacao: normalized.classificacao,
        conta_id: normalized.conta_id,
        conta_nome: normalized.conta_nome,
      }),
    );
    const carteiraLabel = normalized.conta_nome || 'sem carteira';
    return {
      ok: true,
      message: `Transação criada na conta de ${accountLabel} · carteira ${carteiraLabel}${statusLabel}`,
      data: {
        transaction: created,
        contaId: normalized.conta_id,
        contaNome: normalized.conta_nome,
        userId,
        account,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Isto é LANÇAMENTO na carteira (create_transaction), NÃO é nota fiscal NFS-e/NF-e. '
          + 'PROIBIDO dizer "nota fiscal emitida" ou "NFS-e emitida" — diga apenas que o lançamento foi registrado. '
          + 'Confirme ao utilizador SOMENTE após este ok. Na mensagem WhatsApp inclua '
          + `*Conta:* ${accountLabel} (telefone ${phoneDigits}). `
          + `*Carteira:* ${carteiraLabel}. `
          + 'Se o nome não for de quem está a falar, NÃO diga que registrou — reporte erro interno. '
          + 'Cite valor, classificacao, data, carteira e se já contabiliza no saldo (pago/recebido).',
      },
    };
  }

  if (action === 'update_transaction') {
    const allCategories = await categoriesService.listCategories(userId);
    const contas = await transactionsService.listActiveContasFinanceiras(userId);
    const patch = normalizeOpenclawTransactionUpdate(payload, {
      categories: allCategories,
      contas,
    });
    if (patch.tipo && patch.status == null) {
      patch.status = transactionsService.normalizeTransactionStatus(patch.tipo, payload?.status);
    } else if (patch.status != null && patch.tipo) {
      patch.status = transactionsService.normalizeTransactionStatus(patch.tipo, patch.status);
    } else if (patch.status != null) {
      const { data: existing } = await createSupabaseClient({ useServiceRole: true })
        .from('lancamentos_id')
        .select('tipo')
        .eq('id', patch.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing?.tipo) {
        patch.status = transactionsService.normalizeTransactionStatus(existing.tipo, patch.status);
      }
    }
    const updated = await transactionsService.updateTransaction(userId, patch);
    return {
      ok: true,
      message: 'Lançamento actualizado',
      data: { transaction: updated, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'delete_transaction') {
    const txId = resolveOpenclawTransactionId(payload);
    if (!txId) {
      throw badRequest(
        'ID da transação é obrigatório (payload.id ou transactionId)',
      );
    }
    await transactionsService.deleteTransaction(userId, { id: txId }, { id: txId });
    return {
      ok: true,
      message: 'Transação removida',
      data: { success: true, id: txId, actorContext },
    };
  }

  if (action === 'list_agenda_checklist_today') {
    const checklist = await calendarEventsService.listTodayAgendaChecklistForUser(userId);
    return {
      ok: true,
      message: checklist.message,
      data: {
        ...checklist,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Agenda de HOJE em formato checklist (☐ pendente / ✅ concluída). '
          + 'Repita APENAS message. NÃO reformate nem omita o resumo no fim. '
          + '✅ = horário já passou OU marcado manualmente com complete_calendar_event. '
          + 'Para marcar feito: complete_calendar_event com index (número do item), title ou time. '
          + 'Para detalhes de um item, use list_calendar_events com data de hoje.',
      },
    };
  }

  if (action === 'complete_calendar_event') {
    try {
      const completionPayload = {
        ...payload,
        ...(input?.text ? { text: input.text } : {}),
        ...(input?.message ? { message: input.message } : {}),
      };
      const result = await calendarEventsService.completeCalendarEventForUser(
        userId,
        completionPayload,
      );
      return {
        ok: result.ok !== false,
        message: result.message,
        data: {
          checklist: result.data ?? null,
          matchedBy: result.matchedBy ?? null,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            'Compromisso marcado como concluído (ou pedido de desambiguação). '
            + 'Repita APENAS message. Se ambiguous, aguarde o número do item (ex.: «feito 2»). '
            + 'Não invente itens — use os números da última checklist.',
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[OpenClaw] complete_calendar_event:', msg, err);
      throw err;
    }
  }

  if (action === 'get_next_calendar_event') {
    const next = await calendarEventsService.findNextCalendarEventForUser(userId, {
      maxDays: payload?.maxDays ?? payload?.dias ?? 14,
      skipCount: payload?.skipCount ?? payload?.pular ?? payload?.skip,
      afterStart: payload?.afterStart ?? payload?.depoisDe ?? payload?.after,
      afterEventId: payload?.afterEventId ?? payload?.depoisEventId,
    });
    return {
      ok: true,
      message: next.message,
      data: {
        ...next,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'UM compromisso FUTURO por chamada. Repita só message (inclui Data: DD/MM/AAAA). '
          + 'NUNCA cite reunião que já terminou hoje. Início = nextEvent.time. '
          + 'Guarde nextEvent.id para follow-up: depois dela → skipCount 1 ou afterEventId. '
          + 'skipCount 0 = primeiro futuro. Lista do dia sem passados → list_upcoming_calendar_events.',
      },
    };
  }

  if (action === 'list_upcoming_calendar_events') {
    const rawDate = payload?.data ?? payload?.date ?? 'hoje';
    const upcoming = await calendarEventsService.listUpcomingCalendarEventsForUser(userId, {
      date: rawDate,
      data: rawDate,
    });
    return {
      ok: true,
      message: upcoming.message,
      data: {
        ...upcoming,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Próximos compromissos DO DIA pedido (só os que ainda não passaram). '
          + 'Repita só message. NÃO é o próximo único (get_next_calendar_event). '
          + 'NÃO inclui reuniões já realizadas hoje.',
      },
    };
  }

  if (action === 'list_calendar_events') {
    const rawDate = payload?.data ?? payload?.date;
    const scope = String(payload?.scope || '').toLowerCase();
    const wantsUpcomingOnDay =
      scope === 'proximos'
      || scope === 'upcoming'
      || scope === 'proximos_dia'
      || payload?.proximos === true;
    const wantsNext =
      !wantsUpcomingOnDay
      && (
        payload?.next === true
        || (payload?.proximo === true && payload?.proximos !== true)
        || scope === 'next'
      );
    const wantsAgendaSummary =
      scope === 'agenda'
      || scope === 'minha_agenda'
      || payload?.agenda === true
      || payload?.minhaAgenda === true
      || payload?.minha_agenda === true;

    if (wantsUpcomingOnDay && !wantsNext) {
      const rawUpcomingDate = rawDate ?? 'hoje';
      const upcoming = await calendarEventsService.listUpcomingCalendarEventsForUser(userId, {
        date: rawUpcomingDate,
        data: rawUpcomingDate,
      });
      return {
        ok: true,
        message: upcoming.message,
        data: {
          ...upcoming,
          userId,
          actorContext,
          ...linkDebug,
          resolvedAs: 'list_upcoming_calendar_events',
          agentInstructions:
            'Próximos compromissos do dia — só os que faltam. Repita só message.',
        },
      };
    }

    if (wantsAgendaSummary && !wantsNext) {
      const agenda = await calendarEventsService.listCalendarEventsAgendaForUser(userId, {
        daysAhead: payload?.maxDays ?? payload?.dias ?? payload?.days ?? 7,
      });
      return {
        ok: true,
        message: agenda.message,
        data: {
          ...agenda,
          userId,
          actorContext,
          ...linkDebug,
          resolvedAs: 'list_calendar_events_agenda',
          agentInstructions:
            'Responda repetindo APENAS message. Inclui HOJE (mesmo reuniões já realizadas) '
            + 'e os dias seguintes. NÃO diga que não há compromissos se message listou eventos.',
        },
      };
    }

    if (wantsNext) {
      const next = await calendarEventsService.findNextCalendarEventForUser(userId, {
        maxDays: payload?.maxDays ?? payload?.dias ?? 14,
      });
      return {
        ok: true,
        message: next.message,
        data: {
          ...next,
          userId,
          actorContext,
          ...linkDebug,
          resolvedAs: 'get_next_calendar_event',
          agentInstructions:
            'Responda repetindo APENAS message. Hora de início = nextEvent.time, não endTime.',
        },
      };
    }

    const todayIso = calendarEventsService.calendarDateTodayInSaoPaulo();
    const parsedDate = rawDate
      ? calendarEventsService.parseCalendarQueryDate(rawDate)
      : null;
    const isTodayLike =
      !rawDate
      || String(rawDate).toLowerCase() === 'hoje'
      || parsedDate?.iso === todayIso;
    const includePast =
      payload?.includePast === true
      || payload?.passados === true
      || String(payload?.scope || '').toLowerCase() === 'todos'
      || String(payload?.scope || '').toLowerCase() === 'completo';

    if (isTodayLike && !includePast) {
      const upcomingToday = await calendarEventsService.listUpcomingCalendarEventsForUser(
        userId,
        { date: 'hoje', data: 'hoje' },
      );
      if (!upcomingToday.empty) {
        const next = await calendarEventsService.findNextCalendarEventForUser(userId, {
          maxDays: payload?.maxDays ?? payload?.dias ?? 14,
          skipCount: payload?.skipCount,
          afterEventId: payload?.afterEventId,
          afterStart: payload?.afterStart,
        });
        return {
          ok: true,
          message: next.empty ? upcomingToday.message : next.message,
          data: {
            ...(next.empty ? upcomingToday : next),
            userId,
            actorContext,
            ...linkDebug,
            resolvedAs: next.empty
              ? 'list_upcoming_calendar_events'
              : 'get_next_calendar_event',
            agentInstructions:
              'Próximo compromisso = só FUTURO (não cite reunião que já terminou). '
              + 'Repita message com Data + horário. action get_next_calendar_event para "próximo".',
          },
        };
      }
    }

    const calendar = await calendarEventsService.listCalendarEventsForUser(userId, {
      date: rawDate,
      data: rawDate,
    });

    if (calendar.empty && rawDate) {
      const parsed = calendarEventsService.parseCalendarQueryDate(rawDate);
      const todayIso = calendarEventsService.calendarDateTodayInSaoPaulo();
      if (parsed && parsed.iso > todayIso) {
        const next = await calendarEventsService.findNextCalendarEventForUser(userId, {
          maxDays: 7,
        });
        if (!next.empty) {
          return {
            ok: true,
            message: [
              next.message,
              '',
              `(Não há compromissos em ${parsed.display}; o próximo na tua agenda é o indicado acima.)`,
            ].join('\n'),
            data: {
              ...next,
              userId,
              actorContext,
              ...linkDebug,
              redirectedFromEmptyFutureDay: parsed.iso,
              agentInstructions:
                'Responda repetindo APENAS o texto de message (próximo compromisso real). '
                + 'NUNCA digas que não há nada se message já listou um compromisso.',
            },
          };
        }
      }
    }

    return {
      ok: true,
      message: calendar.message,
      data: {
        ...calendar,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Compromissos do DIA INTEIRO (passados + futuros). Copie só message. '
          + 'Próximo único → get_next_calendar_event. '
          + 'Próximos que faltam hoje → list_upcoming_calendar_events. '
          + 'Visão da semana → scope "agenda".',
      },
    };
  }

  if (action === 'add_calendar_event_meet') {
    const meet = await calendarEventsService.addMeetLinkToCalendarEventForUser(userId, payload);
    if (!meet.ok) {
      const hint = meet.notLinked
        ? ' Peça para conectar o Google Calendar na app.'
        : '';
      return {
        ok: false,
        message: `${meet.message || 'Não foi possível gerar o Meet.'}${hint}`,
        data: {
          ...meet,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            'Repita só message. Se ambiguous, peça qual compromisso ou use eventId da listagem.',
        },
      };
    }
    return {
      ok: true,
      message: meet.message,
      data: {
        ...meet,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Envie ao utilizador o link em message (meetLink). '
          + 'Se pendingMeet, chame list_calendar_events para mostrar o Meet quando aparecer.',
      },
    };
  }

  if (action === 'delete_calendar_event') {
    const deleted = await calendarEventsService.deleteCalendarEventForUser(userId, payload);
    if (!deleted.ok) {
      const hint = deleted.notLinked
        ? ' Peça para conectar o Google Calendar na app.'
        : '';
      return {
        ok: false,
        message: `${deleted.message || 'Não foi possível excluir.'}${hint}`,
        data: {
          ...deleted,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            'Repita só message. Se alreadyDeleted, diga que já não está na agenda. '
            + 'Depois chame list_calendar_events para mostrar a lista actual.',
        },
      };
    }
    return {
      ok: true,
      message: deleted.message,
      data: {
        ...deleted,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Confirme a exclusão com message. OBRIGATÓRIO: list_calendar_events em seguida '
          + '(mesma data) para provar que saiu — não uses memória do chat.',
      },
    };
  }

  if (action === 'create_calendar_event') {
    try {
      const created = await calendarEventsService.createCalendarEventForUser(userId, payload);
      if (!created.ok) {
        const hint = created.notLinked
          ? ' Peça para conectar o Google Calendar em Configurações na app.'
          : created.refreshFailed
            ? ' Se o utilizador acabou de conectar, peça para tentar de novo em 1 minuto antes de reconectar.'
            : '';
        const message = `${created.message || 'Não foi possível criar o compromisso.'}${hint}`;
        return {
          ok: false,
          message,
          data: {
            ...created,
            userId,
            actorContext,
            ...linkDebug,
            agentInstructions:
              'Repita só esta message ao utilizador. Não digas "dificuldades técnicas". '
              + 'Se notLinked, explique conectar Google Calendar na app Meu Financeiro.',
          },
        };
      }
      return {
        ok: true,
        message: created.message,
        data: {
          ...created,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            'Repita APENAS a message (título, data, início e fim). NUNCA troque início por fim. '
            + 'Se timeAdjustedToEvening, confirme o horário da tarde/noite indicado na message. '
            + 'Se houver meetLink/hangoutLink, envie o link.',
        },
      };
    } catch (err) {
      const code = err?.errors?.code || err?.code;
      const calendarAskCodes = new Set([
        'CALENDAR_TIME_SLOTS_REQUIRED',
        'CALENDAR_END_TIME_REQUIRED',
        'CALENDAR_END_BEFORE_START',
        'CALENDAR_TIME_INVALID',
        'CALENDAR_END_TIME_INVALID',
      ]);
      if (calendarAskCodes.has(code)) {
        return {
          ok: false,
          message: String(err?.message || 'Informe horário de início e término.'),
          data: {
            code,
            userId,
            actorContext,
            ...linkDebug,
            agentInstructions:
              'Repita APENAS message ao utilizador e aguarde hora início + hora fim. '
              + 'Não chame create_calendar_event de novo até ter time e endTime.',
          },
        };
      }
      throw err;
    }
  }

  const resolveDasCompetencia = () => resolveDasCompetenciaFromPayload(payload);

  const buildDasOwnerLabel = (account) => {
    if (account?.dasOwnerLabel) return account.dasOwnerLabel;
    if (account?.meiCertificadoRazaoSocial) {
      const cnpj = account?.meiCertificadoCnpj
        ? ` (CNPJ ${formatCnpjDisplay(account.meiCertificadoCnpj)})`
        : '';
      return `${account.meiCertificadoRazaoSocial}${cnpj}`;
    }
    return 'MEI — cadastre o certificado A1 na app para identificar o contribuinte no DAS';
  };

  const resolveDasSubjectIfNeeded = async () => {
    if (
      action !== 'get_das_current' &&
      action !== 'get_das_payment_status' &&
      action !== 'send_das_whatsapp' &&
      action !== 'refresh_das_pdf'
    ) {
      return null;
    }
    return resolveDasDataSubject({
      actorUserId: userId,
      actorContext,
      actorLinkDebug: linkDebug,
      payload,
    });
  };

  const dasSubject = await resolveDasSubjectIfNeeded();
  const dasUserId = dasSubject?.dataUserId ?? userId;

  if (action === 'get_das_current') {
    const dasComp = resolveDasCompetencia();
    const { display, periodoDigits } = dasComp;
    let pdfResult;
    try {
      pdfResult = await meiGuideService.fetchDasPdfBase64ForUser(dasUserId, {
        periodoApuracao: periodoDigits,
        cnpj: payload?.cnpj,
        contribuinte: payload?.contribuinte,
      });
    } catch (err) {
      rethrowDasFetchErrorForBot(err, display);
    }
    const pdfBase64 = pdfResult.pdfBase64;
    const fileName = pdfResult.fileName || `DAS-${display.replace('/', '-')}.pdf`;
    const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
    const includeBase64 =
      payload?.includeBase64 === true ||
      String(payload?.includeBase64 || '').toLowerCase() === 'true' ||
      payload?.includeBase64 === 1;

    if (!includeBase64) {
      const deliverExplicit = String(payload?.deliverWhatsapp ?? '').toLowerCase();
      const deliverWhatsapp =
        deliverExplicit === 'true'
        || payload?.deliverWhatsapp === true
        || (deliverExplicit !== 'false'
          && payload?.deliverWhatsapp !== false
          && isWhatsappOutboundConfigured());
      let whatsapp = { whatsappStatus: 'not_requested' };
      if (deliverWhatsapp) {
        whatsapp = await trySendDasWhatsappWebhook({
          userId: dasUserId,
          phone: destinationPhone,
          display,
          periodoDigits,
          pdfBase64,
          fileName,
        });
      }
      const sent = whatsapp.whatsappStatus === 'sent';
      const owner = dasSubject ? buildDasOwnerLabel(dasSubject.account) : null;
      return {
        ok: true,
        message: sent
          ? `PDF DAS ${display} enviado no WhatsApp (${owner}).`
          : `DAS ${display} de ${owner}. Envio WhatsApp: ${whatsapp.whatsappStatus}. `
            + `Use exec: mf-das-send.sh ${destinationPhone || 'TELEFONE_PAINEL'} ${display}`,
        data: {
          fileName,
          mes: display,
          mimeType: 'application/pdf',
          includeBase64: false,
          whatsappStatus: whatsapp.whatsappStatus,
          whatsappError: whatsapp.whatsappError ?? null,
          hint: whatsapp.hint ?? null,
          dasAccount: dasSubject?.account ?? null,
          dasOwnerLabel: dasSubject?.account?.dasOwnerLabel ?? null,
          meiCertificadoRazaoSocial: dasSubject?.account?.meiCertificadoRazaoSocial ?? null,
          accessedAsSelf: dasSubject?.accessedAsSelf ?? true,
          execCommand: destinationPhone
            ? `/home/node/.openclaw/workspace/mf-das-send.sh ${destinationPhone} ${display}`
            : null,
          agentInstructions:
            'Use dasOwnerLabel/meiCertificadoRazaoSocial (certificado), NÃO displayName. Para enviar PDF: send_das_whatsapp ou mf-das-send.sh.'
            + (dasComp.resolvedBy === 'vencimento_dia_20'
              ? ` Competência ${display} (vencimento ${dasComp.vencimentoDisplay || 'dia 20'}).`
              : ''),
          competenciaResolvida: dasComp.resolvedBy ?? null,
          vencimentoDisplay: dasComp.vencimentoDisplay ?? null,
          actorContext,
          ...(dasSubject?.dataLinkDebug ?? linkDebug),
        },
      };
    }

  const owner = dasSubject ? buildDasOwnerLabel(dasSubject.account) : null;
  return {
    ok: true,
    message: `DAS encontrado (${owner}).`,
      data: {
        fileName,
        mimeType: 'application/pdf',
        base64: pdfBase64,
        mes: display,
        competenciaResolvida: dasComp.resolvedBy ?? null,
        vencimentoDisplay: dasComp.vencimentoDisplay ?? null,
        dasAccount: dasSubject?.account ?? null,
        accessedAsSelf: dasSubject?.accessedAsSelf ?? true,
        actorContext,
        ...(dasSubject?.dataLinkDebug ?? linkDebug),
      },
    };
  }

  if (action === 'get_das_payment_status') {
    const dasComp = resolveDasCompetencia();
    const { display, periodoDigits } = dasComp;
    const competenciaIso = `${periodoDigits.slice(0, 4)}-${periodoDigits.slice(4, 6)}`;
    const refreshFromSerpro =
      payload?.refreshFromSerpro === true ||
      String(payload?.refreshFromSerpro || '').toLowerCase() === 'true';
    const statusInfo = await getDasPaymentStatusForUser({
      userId: dasUserId,
      competencia: competenciaIso,
      refreshFromSerpro,
    });
    const owner = dasSubject ? buildDasOwnerLabel(dasSubject.account) : '';
    const replyMessage = `${buildDasPaymentStatusMessage({
      status: statusInfo.status,
      display,
      hasPdf: statusInfo.hasPdf,
    })} Conta: ${owner}.`;
    return {
      ok: true,
      message: replyMessage,
      data: {
        mes: display,
        competencia: statusInfo.competencia,
        status: statusInfo.status,
        statusLabel: statusInfo.statusLabel,
        hasPdf: statusInfo.hasPdf,
        statusSource: statusInfo.statusSource,
        updatedAt: statusInfo.updatedAt,
        isPaid: statusInfo.status === 'pago',
        isPending: statusInfo.status === 'pendente',
        competenciaResolvida: dasComp.resolvedBy ?? null,
        vencimentoDisplay: dasComp.vencimentoDisplay ?? null,
        agentInstructions:
          dasComp.resolvedBy === 'vencimento_dia_20'
            ? `DAS competência ${display} (vence ${dasComp.vencimentoDisplay}). Não confundir com mês calendário.`
            : null,
        dasAccount: dasSubject?.account ?? null,
        accessedAsSelf: dasSubject?.accessedAsSelf ?? true,
        actorContext,
        ...(dasSubject?.dataLinkDebug ?? linkDebug),
      },
    };
  }

  if (action === 'send_das_whatsapp') {
    const dasComp = resolveDasCompetencia();
    const { display, periodoDigits } = dasComp;
    let pdfResult;
    try {
      pdfResult = await meiGuideService.fetchDasPdfBase64ForUser(dasUserId, {
        periodoApuracao: periodoDigits,
        cnpj: payload?.cnpj,
        contribuinte: payload?.contribuinte,
      });
    } catch (err) {
      rethrowDasFetchErrorForBot(err, display);
    }
    const pdfBase64 = pdfResult.pdfBase64;
    const fileName = pdfResult.fileName || `DAS-${display.replace('/', '-')}.pdf`;
    const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
    const whatsapp = await trySendDasWhatsappWebhook({
      userId: dasUserId,
      phone: destinationPhone,
      display,
      periodoDigits,
      pdfBase64,
      fileName,
    });
    const sent = whatsapp.whatsappStatus === 'sent';
    const owner = dasSubject ? buildDasOwnerLabel(dasSubject.account) : '';
    return {
      ok: true,
      message: sent
        ? `PDF DAS ${display} enviado no WhatsApp (conta: ${owner}).`
        : `DAS ${display} de ${owner}; envio WhatsApp: ${whatsapp.whatsappStatus}. `
          + (whatsapp.hint || `Use mf-das-send.sh ${destinationPhone} ${display}`),
      data: {
        mes: display,
        fileName,
        competenciaResolvida: dasComp.resolvedBy ?? null,
        vencimentoDisplay: dasComp.vencimentoDisplay ?? null,
        whatsappStatus: whatsapp.whatsappStatus,
        whatsappError: whatsapp.whatsappError ?? null,
        hint: whatsapp.hint ?? null,
        dasAccount: dasSubject?.account ?? null,
        dasOwnerLabel: dasSubject?.account?.dasOwnerLabel ?? null,
        meiCertificadoRazaoSocial: dasSubject?.account?.meiCertificadoRazaoSocial ?? null,
        accessedAsSelf: dasSubject?.accessedAsSelf ?? true,
        useOpenclawScript: sent
          ? null
          : `/home/node/.openclaw/workspace/mf-das-send.sh ${destinationPhone} ${display}`,
        agentInstructions: sent
          ? `Confirme só que o PDF da competência ${display} foi enviado.`
            + (dasComp.vencimentoDisplay ? ` Vencimento ${dasComp.vencimentoDisplay}.` : '')
          : 'OBRIGATÓRIO exec mf-das-send.sh com telefone do PAINEL. Não diga que enviou sem whatsappStatus=sent.',
        actorContext,
        ...(dasSubject?.dataLinkDebug ?? linkDebug),
      },
    };
  }

  if (action === 'get_google_calendar_status') {
    const status = await calendarEventsService.getGoogleCalendarConnectionStatus(userId);
    return {
      ok: status.ready,
      message: status.message,
      data: {
        status,
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions: status.ready
          ? 'Google Calendar OK — pode create_calendar_event.'
          : 'Repita só message. Se notLinked, oriente Configurações → Google Calendar na app. '
            + 'Se acabou de conectar, peça para tentar criar o compromisso de novo em 1 minuto.',
      },
    };
  }

  if (action === 'get_nfse_setup_status') {
    const setup = await getOpenclawNfseSetupStatus(userId);
    return {
      ok: true,
      message: setup.ready
        ? 'Conta pronta para emitir NFSe pelo WhatsApp.'
        : `Cadastro incompleto para NFSe: ${setup.missing.join(', ')}. Complete na app MEI → Notas.`,
      data: { setup, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'sync_nfse_emitente') {
    const sync = await syncOpenclawNfseEmitente(userId);
    const setup = await getOpenclawNfseSetupStatus(userId);
    return {
      ok: true,
      message: setup.ready
        ? 'Prestador NFSe sincronizado e pronto para emitir.'
        : `Sync executado mas ainda incompleto: ${setup.missing.join(', ')}. Ver data.sync.heal.`,
      data: { sync, setup, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_nfse_clientes') {
    const q = String(
      payload?.q ?? payload?.nome ?? payload?.busca ?? payload?.documento ?? '',
    ).trim();
    const limit = payload?.limit;
    const clientes = await listOpenclawNfseClientes(userId, { q, limit });
    const docHint = q
      ? ' Se não aparecer o cliente certo, cadastre com register_nfse_cliente antes de emit_nfse.'
      : '';
    return {
      ok: true,
      message: `${clientes.length} cliente(s) no catálogo NFSe.${docHint}`,
      data: { clientes, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'register_nfse_cliente') {
    try {
      const result = await registerOpenclawNfseCliente(userId, payload);
      const nome = result.cliente?.nome || 'Cliente';
      const doc = result.cliente?.documento || '';
      let message = result.alreadyRegistered
        ? `Cliente já cadastrado: ${nome} (${doc}).`
        : `Cliente cadastrado: ${nome} (${doc}).`;
      let agentInstructions;
      if (result.enderecoEnriched && !result.enderecoIncomplete) {
        message = `Endereço fiscal atualizado para ${nome}. Pode continuar a emissão da nota.`;
      } else if (result.enderecoIncomplete) {
        message = result.userMessage || result.botHint || `Falta completar o endereço fiscal de ${nome}.`;
        agentInstructions = result.botHint
          || 'Repita APENAS message. Quando o utilizador responder, register_nfse_cliente com tomadorNome + campo em falta.';
      } else if (!result.enderecoIncomplete) {
        message += ' Pode emitir a nota quando quiser.';
      }
      return {
        ok: true,
        message,
        data: {
          ...result,
          userId,
          actorContext,
          ...linkDebug,
          ...(agentInstructions ? { agentInstructions } : {}),
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'list_nfse_produtos') {
    const q = String(
      payload?.q ?? payload?.nome ?? payload?.busca ?? payload?.produto ?? payload?.servico ?? '',
    ).trim();
    const limit = payload?.limit;
    const documentType = resolveCatalogDocumentType(payload) || 'NFSE';
    if (documentType === 'NFE') {
      const produtos = await listOpenclawNfeProdutos(userId, { q, limit });
      return {
        ok: true,
        message: formatOpenclawNfeProdutosMessage(produtos),
        data: { produtos, documentType: 'NFE', userId, actorContext, ...linkDebug },
      };
    }
    const produtos = await listOpenclawNfseProdutos(userId, { q, limit, documentType: 'NFSE' });
    return {
      ok: true,
      message: formatOpenclawCatalogServicosMessage(produtos),
      data: { produtos, documentType: 'NFSE', userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'list_catalog_servicos') {
    const q = String(
      payload?.q ?? payload?.nome ?? payload?.busca ?? payload?.servico ?? '',
    ).trim();
    const limit = payload?.limit;
    const produtos = await listOpenclawNfseProdutos(userId, { q, limit, documentType: 'NFSE' });
    return {
      ok: true,
      message: formatOpenclawCatalogServicosMessage(produtos),
      data: {
        produtos,
        documentType: 'NFSE',
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Mostre APENAS message (lista numerada). Espere o utilizador escolher serviço antes de preview_nfse. '
          + 'PROIBIDO inventar descricao genérica.',
      },
    };
  }

  if (action === 'list_nfe_produtos') {
    const q = String(
      payload?.q ?? payload?.nome ?? payload?.busca ?? payload?.produto ?? '',
    ).trim();
    const limit = payload?.limit;
    const produtos = await listOpenclawNfeProdutos(userId, { q, limit });
    return {
      ok: true,
      message: formatOpenclawNfeProdutosMessage(produtos),
      data: {
        produtos,
        documentType: 'NFE',
        userId,
        actorContext,
        ...linkDebug,
        agentInstructions:
          'Mostre APENAS message (lista numerada). Espere escolha do produto antes de preview_nfe.',
      },
    };
  }

  if (action === 'register_nfe_cliente') {
    try {
      const result = await registerOpenclawNfeCliente(userId, payload);
      const nome = result.cliente?.nome || 'Cliente';
      const doc = result.cliente?.documento || '';
      return {
        ok: true,
        message: `Cliente NF-e cadastrado: ${nome} (${doc}). Use list_nfe_produtos e preview_nfe antes de emit_nfe.`,
        data: { ...result, userId, actorContext, ...linkDebug },
      };
    } catch (err) {
      rethrowNfeErrorForBot(err);
    }
  }

  if (action === 'register_nfe_produto') {
    try {
      const result = await registerOpenclawNfeProduto(userId, payload);
      const nome = result.produto?.discriminacao || 'Produto';
      const codigo = result.produto?.codigo || '';
      return {
        ok: true,
        message: `Produto NF-e cadastrado: ${nome} (SKU ${codigo}). Já pode pedir a emissão da nota de produto.`,
        data: { ...result, userId, actorContext, ...linkDebug },
      };
    } catch (err) {
      rethrowNfeErrorForBot(err);
    }
  }

  if (action === 'preview_nfe') {
    try {
      const preview = await previewOpenclawNfeEmit(userId, payload);
      return {
        ok: true,
        message: buildNfConfirmRequestUserMessage(preview),
        data: {
          preview,
          requiresConfirm: true,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            `${BOT_NF_CONFIRM_INSTRUCTION} ${BOT_NF_PREVIEW_LOOP_GUARD} `
              + 'Repita APENAS o campo message ao utilizador.',
        },
      };
    } catch (err) {
      rethrowNfeErrorForBot(err);
    }
  }

  if (action === 'emit_nfe') {
    try {
      const result = await emitOpenclawNfe(userId, payload);
      if (result.requiresConfirm) {
        const p = result.preview;
        return {
          ok: true,
          message: buildNfConfirmRequestUserMessage(p),
          data: {
            preview: result.preview,
            requiresConfirm: true,
            notEmitted: true,
            userId,
            actorContext,
            ...linkDebug,
            agentInstructions:
              `${BOT_NF_CONFIRM_INSTRUCTION} ${BOT_NF_PREVIEW_LOOP_GUARD} `
              + 'Repita APENAS o campo message ao utilizador.',
          },
        };
      }
      const nota = result.nota;
      const status = nota?.status || 'processando';
      return {
        ok: true,
        message: buildNfEmittedUserMessage(result.preview, {
          status,
          pdfPending: true,
        }),
        data: {
          nota: {
            id: nota?.id,
            status: nota?.status,
            plugnotas_id: nota?.plugnotas_id,
            document_type: nota?.document_type || 'NFE',
          },
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            'Nota NF-e em processamento. Repita APENAS message — não mencione payload nem confirm:true.',
        },
      };
    } catch (err) {
      rethrowNfeErrorForBot(err);
    }
  }

  if (action === 'register_nfse_produto') {
    try {
      const catalogoExistente = await listOpenclawNfseProdutos(userId, { limit: 20 });
      const forceRegister = payload?.forceRegister === true || payload?.force_register === true;
      if (catalogoExistente.length > 0 && !forceRegister) {
        return {
          ok: true,
          message:
            `Catálogo já tem ${catalogoExistente.length} serviço(s). `
            + 'Use list_nfse_produtos e emit_nfse — não cadastre de novo pelo WhatsApp.',
          data: {
            alreadyRegistered: true,
            registerBlocked: true,
            produtos: catalogoExistente,
            userId,
            actorContext,
            ...linkDebug,
            botHint:
              'PROIBIDO register_nfse_produto quando o catálogo não está vazio. '
              + 'Emita com emit_nfse usando descricao do catálogo.',
          },
        };
      }
      const result = await registerOpenclawNfseProduto(userId, payload);
      const nome = result.produto?.discriminacao || 'Serviço';
      const codigo = result.produto?.codigo || '';
      const cnae = result.produto?.cnae || '';
      return {
        ok: true,
        message: result.alreadyRegistered
          ? `Serviço já existe no catálogo (cód. ${codigo}, CNAE ${cnae}): ${nome}. Use list_nfse_produtos e emit_nfse — não cadastre de novo.`
          : `Serviço cadastrado: ${nome} (cód. ${codigo}, CNAE ${cnae}). Pode usar em preview_nfse e emit_nfse.`,
        data: {
          ...result,
          userId,
          actorContext,
          ...linkDebug,
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'preview_nfse') {
    try {
      const preview = await previewOpenclawNfseEmit(userId, payload);
      return {
        ok: true,
        message: buildNfConfirmRequestUserMessage(preview),
        data: {
          preview,
          requiresConfirm: true,
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions:
            `${BOT_NF_CONFIRM_INSTRUCTION} ${BOT_NF_PREVIEW_LOOP_GUARD} `
              + 'Repita APENAS o campo message ao utilizador.',
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'emit_nfse') {
    try {
      const result = await emitOpenclawNfse(userId, payload);
      if (result.requiresConfirm) {
        return {
          ok: true,
          message: buildNfConfirmRequestUserMessage(result.preview),
          data: {
            preview: result.preview,
            requiresConfirm: true,
            notEmitted: true,
            userId,
            actorContext,
            ...linkDebug,
            agentInstructions:
              `${BOT_NF_CONFIRM_INSTRUCTION} ${BOT_NF_PREVIEW_LOOP_GUARD} `
              + 'Repita APENAS o campo message ao utilizador.',
          },
        };
      }
      const nota = result.nota;
      const status = nota?.status || 'processando';
      const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
      const pdfReady = isNfsePdfReadyStatus(status);
      const autoEnabled = isOpenclawNfseAutoWhatsappEnabled();
      let autoWhatsapp = null;

      if (autoEnabled && destinationPhone && nota?.id) {
        await registerOpenclawNfseWhatsappDelivery(userId, nota.id, destinationPhone);
        if (pdfReady) {
          autoWhatsapp = await deliverOpenclawNfseWhatsappPdf(
            userId,
            nota.id,
            destinationPhone,
          );
        }
      }

      const autoSent = autoWhatsapp?.whatsappStatus === 'sent';
      const autoFailed = ['failed', 'skipped_no_whatsapp'].includes(
        autoWhatsapp?.whatsappStatus || '',
      );
      if (autoEnabled && nota?.id && !autoSent) {
        scheduleOpenclawNfseWhatsappDeliveryRetries(userId, nota.id);
      }
      const useOpenclawScriptFallback = !autoSent && (!autoEnabled || autoFailed);
      const execCommand =
        useOpenclawScriptFallback && pdfReady && destinationPhone && nota?.id
          ? buildNfseSendExecCommand(destinationPhone, nota.id)
          : null;

      const userMessage = buildNfEmittedUserMessage(result.preview, {
        status,
        pdfSent: autoSent,
        pdfPending: autoEnabled && !pdfReady,
      });

      let agentInstructions =
        'Repita APENAS o campo message ao utilizador. PROIBIDO mencionar payload, confirm:true ou ações técnicas.';
      if (autoSent) {
        agentInstructions += ' PDF já enviado no WhatsApp — não peça confirmação nem script.';
      } else if (autoEnabled) {
        agentInstructions += ' O PDF será enviado automaticamente — não peça mf-nfse-send.sh ao utilizador.';
      } else if (execCommand) {
        agentInstructions += ' Envio manual pendente — usa execCommand internamente se necessário.';
      }

      return {
        ok: true,
        message: userMessage,
        data: {
          nota: {
            id: nota?.id,
            status: nota?.status,
            plugnotas_id: nota?.plugnotas_id,
            id_integracao: nota?.id_integracao,
            pdf_url: nota?.pdf_url,
            pdfReady,
          },
          execCommand,
          autoWhatsappEnabled: autoEnabled,
          autoWhatsapp: autoWhatsapp
            ? {
              status: autoWhatsapp.whatsappStatus,
              error: autoWhatsapp.whatsappError ?? null,
            }
            : null,
          pdfWhatsappAlreadySent: autoSent,
          doNotRunNfseSendScript: autoSent || (autoEnabled && !autoFailed),
          userId,
          actorContext,
          ...linkDebug,
          agentInstructions,
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'list_nfse_notas') {
    const limit = payload?.limit;
    const notas = await listOpenclawNfseNotas(userId, { limit });
    return {
      ok: true,
      message: `${notas.length} nota(s) NFSe recente(s).`,
      data: { notas, userId, actorContext, ...linkDebug },
    };
  }

  if (action === 'consult_nfse') {
    try {
      const sync =
        payload?.sync !== false
        && String(payload?.sync || '').toLowerCase() !== 'false';
      const nota = await consultOpenclawNfse(userId, { id: payload?.id, sync });
      const delivery = await getOpenclawNfseWhatsappDeliveryState(userId, nota.id);
      const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
      const autoEnabled = isOpenclawNfseAutoWhatsappEnabled();
      const autoJustSent = nota.whatsappDeliveryAttempt?.status === 'sent';
      const execCommand =
        nota.pdfReady && !delivery.alreadySent && !autoJustSent && !autoEnabled
          ? buildNfseSendExecCommand(destinationPhone, nota.id)
          : null;
      let sendHint = '';
      if (delivery.alreadySent || autoJustSent) {
        sendHint = ' PDF já enviado no WhatsApp.';
      } else if (autoEnabled && nota.pdfReady) {
        const attemptStatus = nota.whatsappDeliveryAttempt?.status;
        if (attemptStatus === 'failed' || attemptStatus === 'error') {
          sendHint = ' Envio automático falhou — use mf-nfse-send.sh.';
        } else if (attemptStatus === 'waiting') {
          sendHint = ' PDF ainda em fila de envio automático.';
        } else {
          sendHint = ' Envio automático activo — aguarde ou use mf-nfse-send.sh se não chegar.';
        }
      } else if (autoEnabled) {
        sendHint = ' Envio automático activo quando a nota concluir.';
      } else if (nota.pdfReady) {
        sendHint = ' Para enviar no WhatsApp use mf-nfse-send.sh com o telefone do remetente.';
      }
      return {
        ok: true,
        message: `Nota ${nota.id}: status ${nota.status || '—'}.${nota.pdfReady ? ' PDF pronto.' : ''}${sendHint}`,
        data: {
          nota,
          execCommand,
          whatsappDelivery: delivery,
          doNotRunNfseSendScript: delivery.alreadySent || autoEnabled,
          userId,
          actorContext,
          ...linkDebug,
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'get_nfse_pdf') {
    try {
      const sync =
        payload?.sync !== false
        && String(payload?.sync || '').toLowerCase() !== 'false';
      const pdfResult = await fetchOpenclawNfsePdfBase64(userId, {
        id: payload?.id,
        sync,
      });
      const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
      const includeBase64 =
        payload?.includeBase64 === true
        || String(payload?.includeBase64 || '').toLowerCase() === 'true'
        || payload?.includeBase64 === 1;

      if (!includeBase64) {
        return {
          ok: true,
          message: `PDF NFSe pronto (${pdfResult.nota.status}). Para enviar no WhatsApp use mf-nfse-send.sh.`,
          data: {
            fileName: pdfResult.fileName,
            mimeType: pdfResult.mimeType,
            includeBase64: false,
            nota: pdfResult.nota,
            execCommand: buildNfseSendExecCommand(destinationPhone, pdfResult.nota.id),
            actorContext,
            ...linkDebug,
          },
        };
      }

      return {
        ok: true,
        message: `PDF NFSe obtido (status ${pdfResult.nota.status}).`,
        data: {
          fileName: pdfResult.fileName,
          mimeType: pdfResult.mimeType,
          base64: pdfResult.base64,
          nota: pdfResult.nota,
          actorContext,
          ...linkDebug,
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'send_nfse_whatsapp') {
    try {
      const notaId = String(payload?.id || '').trim();
      const priorDelivery = await getOpenclawNfseWhatsappDeliveryState(userId, notaId);
      if (priorDelivery.alreadySent) {
        return {
          ok: true,
          message: 'PDF desta NFSe já foi enviado no WhatsApp (sem duplicar).',
          data: {
            notaId,
            whatsappStatus: 'already_sent',
            whatsappDelivery: priorDelivery,
            execCommand: null,
            userId,
            actorContext,
            ...linkDebug,
          },
        };
      }

      const sync =
        payload?.sync !== false
        && String(payload?.sync || '').toLowerCase() !== 'false';
      const pdfResult = await fetchOpenclawNfsePdfBase64(userId, {
        id: notaId,
        sync,
      });
      const destinationPhone = resolveOpenclawWhatsappPhone(phoneDigits, matchedUserNumber);
      const whatsapp = await trySendWhatsappPdfOutbound({
        phone: destinationPhone,
        pdfBase64: pdfResult.base64,
        fileName: pdfResult.fileName,
        message: String(payload?.message || '').trim() || 'Segue a NFSe emitida.',
        extraPayload: { notaId: pdfResult.nota.id, userId },
      });
      const sent = whatsapp.whatsappStatus === 'sent';
      if (sent) {
        await markOpenclawNfseWhatsappSent(userId, pdfResult.nota.id);
      }
      return {
        ok: true,
        message: sent
          ? `PDF NFSe enviado no WhatsApp (nota ${pdfResult.nota.id}).`
          : `PDF obtido; envio WhatsApp: ${whatsapp.whatsappStatus}. Use mf-nfse-send.sh no OpenClaw.`,
        data: {
          nota: pdfResult.nota,
          fileName: pdfResult.fileName,
          whatsappStatus: whatsapp.whatsappStatus,
          whatsappError: whatsapp.whatsappError ?? null,
          hint: whatsapp.hint ?? null,
          execCommand: sent
            ? null
            : buildNfseSendExecCommand(destinationPhone, pdfResult.nota.id),
          actorContext,
          ...linkDebug,
        },
      };
    } catch (err) {
      rethrowNfseErrorForBot(err);
    }
  }

  if (action === 'refresh_das_pdf') {
    const { display, periodoDigits } = resolveDasCompetencia();
    const guide = await meiGuideService.regenerateDasPdf(dasUserId, {
      cnpj: payload?.cnpj,
      periodoApuracao: periodoDigits,
      contribuinte: payload?.contribuinte,
    });
    if (!guide?.pdfBase64) {
      throw notFound(`SERPRO não devolveu PDF para ${display}.`);
    }
    await upsertDasBase64({
      userId: dasUserId,
      periodoApuracao: periodoDigits,
      pdfBase64: guide.pdfBase64,
    });
    const owner = dasSubject ? buildDasOwnerLabel(dasSubject.account) : '';
    return {
      ok: true,
      message: `DAS ${display} regenerado na Receita e guardado (${owner}). Agora use mf-das-send.sh.`,
      data: {
        mes: display,
        refreshed: true,
        dasAccount: dasSubject?.account ?? null,
        execCommand: destinationPhone
          ? `/home/node/.openclaw/workspace/mf-das-send.sh ${destinationPhone} ${display}`
          : null,
        ...(dasSubject?.dataLinkDebug ?? linkDebug),
      },
    };
  }

  throw badRequest(
    `Ação desconhecida: "${action}". Use: ping, resolve_user, list_roles, get_permissions, check_permission, list_access_requests, approve_access_request, reject_access_request, list_categories, list_contas, get_saldo, create_conta, update_conta, delete_conta, list_transactions, create_transaction, update_transaction, delete_transaction, list_calendar_events, list_agenda_checklist_today, complete_calendar_event, list_upcoming_calendar_events, get_next_calendar_event, create_calendar_event, add_calendar_event_meet, delete_calendar_event, get_nfse_setup_status, list_nfse_clientes, register_nfse_cliente, list_nfse_produtos, list_catalog_servicos, list_nfe_produtos, register_nfse_produto, register_nfe_cliente, register_nfe_produto, preview_nfse, emit_nfse, preview_nfe, emit_nfe, list_nfse_notas, consult_nfse, get_nfse_pdf, send_nfse_whatsapp, get_das_payment_status, get_das_current, send_das_whatsapp, refresh_das_pdf.`,
  );
};
