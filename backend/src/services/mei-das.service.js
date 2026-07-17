import { createSupabaseClient, getServiceRoleClient } from '../config/supabase.js';
import { withRetry } from '../utils/retry.js';
import { badRequest, forbidden } from '../utils/errors.js';
import { env } from '../config/env.js';
import * as usersService from './users.service.js';
import * as meiGuideService from './mei-guide.service.js';
import { getCertificateDocument } from './mei-certificate-store.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';
import { getDasBase64 } from './mei-guide-das-base64.service.js';
import { isCompetenciaPaid } from './mei-period-status.service.js';

const DAS_BUCKET = 'mei-das-pdfs';
const DAS_TABLE = 'das_mensal_status';
const DAS_JOB_RUNS_TABLE = 'das_mensal_job_runs';
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULER_HOUR = 8;
const SCHEDULER_TIMEZONE = 'America/Sao_Paulo';

let schedulerHandle = null;
let lastRunKey = null;
let bucketEnsured = false;

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const isAutoWhatsappAfterDasEnabled = () =>
  String(env.MEI_DAS_AUTO_WHATSAPP_ENABLED || '').toLowerCase() === 'true';

const normalizePhoneForWhatsapp = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
};

const fetchAuthUserContactForWhatsapp = async (userId) => {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  const u = data.user;
  const meta = u.user_metadata || {};
  const phone = normalizePhoneForWhatsapp(meta.phone);
  const displayName = meta.display_name || meta.full_name || u.email || 'Cliente';
  return {
    email: u.email || null,
    displayName: String(displayName).trim() || 'Cliente',
    phone
  };
};

const fetchEmpresaNome = async (empresaId) => {
  if (!empresaId) return null;
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('empresas')
    .select('empresa')
    .eq('id', empresaId)
    .maybeSingle();
  if (error) return null;
  return data?.empresa || null;
};

/**
 * Mesmo contrato que `sendAdminMeiWhatsapp` → n8n (ver `docs/ops/n8n-zapi-das-mei.md`).
 * Não lança: falhas só em log para não derrubar o job mensal.
 * @returns {Promise<string>} código para diagnóstico (ex.: `sent`, `skipped_no_phone`).
 */
const trySendAutomaticDasWhatsapp = async ({
  userId,
  empresaId,
  competencia,
  periodoApuracao,
  cnpj,
  pdfBase64
}) => {
  if (!isAutoWhatsappAfterDasEnabled()) return 'skipped_disabled';
  if (!isWhatsappOutboundConfigured()) {
    console.warn(
      '[mei-das] MEI_DAS_AUTO_WHATSAPP_ENABLED=true mas WhatsApp outbound não está configurado (Z-API ou n8n)',
    );
    return 'skipped_no_whatsapp';
  }
  if (!pdfBase64) return 'skipped_no_pdf';

  const contact = await fetchAuthUserContactForWhatsapp(userId);
  if (!contact?.phone) {
    console.info('[mei-das] WhatsApp automático ignorado (sem telefone em user_metadata)', { userId, competencia });
    return 'skipped_no_phone';
  }

  const empresaName = await fetchEmpresaNome(empresaId);
  const displayName = contact.displayName;
  const message = `Olá ${displayName}, segue a guia DAS MEI da competência ${competencia}.`;
  const payload = {
    userId,
    displayName,
    email: contact.email,
    phone: contact.phone,
    empresaId: empresaId || null,
    empresaName: empresaName || null,
    competencia,
    periodoApuracao,
    cnpj: cnpj || null,
    pdfBase64,
    fileName: `das-mei-${periodoApuracao}.pdf`,
    source: 'mei_das_automatico',
    message
  };

  try {
    await sendWhatsappMessage(payload);
    console.info('[mei-das] WhatsApp automático enviado', { userId, competencia });
    return 'sent';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[mei-das] Falha no WhatsApp automático', { userId, competencia, message: msg });
    return 'failed';
  }
};

/** Expõe `error.cause` (ex.: ECONNREFUSED) — `fetch failed` sozinho é pouco útil em diagnóstico. */
const formatDasJobErrorMessage = (error) => {
  if (!(error instanceof Error)) return String(error);
  const bits = [error.message];
  const c = error.cause;
  if (c instanceof Error) bits.push(`cause: ${c.message}`);
  else if (c !== undefined && c !== null) bits.push(`cause: ${String(c)}`);
  return bits.join(' — ');
};

const competenciaToPeriodoApuracao = (competencia) => competencia.replace('-', '');

const normalizeStatus = (status) => {
  const text = String(status || '').toLowerCase();
  if (text === 'pago') return 'pago';
  if (text === 'erro') return 'erro';
  if (text === 'a_pagar') return 'pendente';
  return 'pendente';
};

export const normalizeStatusFilter = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase().trim();
  if (normalized === 'a_pagar') return 'pendente';
  if (!['pago', 'pendente', 'erro'].includes(normalized)) {
    throw badRequest('Status inválido. Use pago, pendente ou erro.');
  }
  return normalized;
};

const getSaoPauloDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
};

const buildCurrentRunKey = (date = new Date()) => {
  const { year, month } = getSaoPauloDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
};

const formatCompetencia = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

export const getPreviousCompetencia = (referenceDate = new Date()) => {
  const current = getSaoPauloDateParts(referenceDate);
  const previousMonth = current.month === 1 ? 12 : current.month - 1;
  const previousYear = current.month === 1 ? current.year - 1 : current.year;
  return formatCompetencia(previousYear, previousMonth);
};

export const normalizeCompetencia = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    throw badRequest('Competência inválida. Use o formato YYYY-MM.');
  }
  return text;
};

export const shouldRunMonthlyJob = (date = new Date()) => {
  const { day, hour } = getSaoPauloDateParts(date);
  return day === 1 && hour >= SCHEDULER_HOUR;
};

const ensureStorageBucket = async () => {
  if (bucketEnsured) return;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para armazenamento do DAS');
  }
  const supabase = getServiceRoleClient();
  const { error } = await supabase.storage.createBucket(DAS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf']
  });
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw badRequest(error.message || 'Falha ao criar bucket de DAS');
  }
  bucketEnsured = true;
};

const uploadDasPdf = async ({ userId, competencia, pdfBuffer }) => {
  await ensureStorageBucket();
  const supabase = getServiceRoleClient();
  const path = `${userId}/${competencia}.pdf`;
  const { error } = await supabase.storage
    .from(DAS_BUCKET)
    .upload(path, pdfBuffer, {
      upsert: true,
      contentType: 'application/pdf'
    });
  if (error) {
    throw badRequest(error.message || 'Falha ao armazenar PDF do DAS');
  }
  return { bucket: DAS_BUCKET, path };
};

const upsertDasRecord = async ({
  userId,
  empresaId,
  competencia,
  documentoFiscal,
  status,
  pdfBucket,
  pdfPath,
  source,
  errorMessage
}) => {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(DAS_TABLE)
    .upsert({
      user_id: userId,
      empresa_id: empresaId,
      competencia,
      documento_fiscal: documentoFiscal || null,
      status: normalizeStatus(status),
      pdf_bucket: pdfBucket || DAS_BUCKET,
      pdf_path: pdfPath || '',
      source: source || 'automatico',
      error_message: errorMessage || null
    }, { onConflict: 'user_id,competencia' })
    .select('id, user_id, empresa_id, competencia, documento_fiscal, status, pdf_bucket, pdf_path, source, error_message, generated_at, updated_at')
    .maybeSingle();
  if (error) {
    throw badRequest(error.message || 'Falha ao salvar registro do DAS');
  }
  return data;
};

const resolveStatusFromSerpro = async (userId, cnpj, competencia) => {
  try {
    const periods = await meiGuideService.listPeriods(userId, { cnpj });
    const period = (periods || []).find((item) => item.competencia === competencia);
    if (!period) return 'pendente';
    return normalizeStatus(period.status);
  } catch {
    return 'pendente';
  }
};

export const generateAndStoreDasForUser = async ({
  userId,
  empresaId,
  competencia,
  source = 'automatico'
}) => {
  if (!userId) {
    throw badRequest('Usuário não informado para geração do DAS');
  }
  if (!empresaId) {
    throw badRequest('Empresa do usuário não encontrada para geração do DAS');
  }
  const resolvedCompetencia = normalizeCompetencia(competencia) || getPreviousCompetencia();
  const periodoApuracao = competenciaToPeriodoApuracao(resolvedCompetencia);
  const document = await getCertificateDocument(userId);
  const cnpj = normalizeDoc(document);
  if (cnpj.length !== 14) {
    const errorMessage = 'Certificado do usuário não possui CNPJ válido';
    await upsertDasRecord({
      userId,
      empresaId,
      competencia: resolvedCompetencia,
      documentoFiscal: null,
      status: 'erro',
      pdfBucket: DAS_BUCKET,
      pdfPath: '',
      source,
      errorMessage
    });
    throw badRequest(errorMessage);
  }

  const guide = await meiGuideService.createGuideByCnpj(userId, {
    cnpj,
    periodoApuracao
  });
  const pdfBase64 = guide?.pdfBase64;
  if (!pdfBase64) {
    const errorMessage = 'PDF do DAS não retornado para armazenamento';
    await upsertDasRecord({
      userId,
      empresaId,
      competencia: resolvedCompetencia,
      documentoFiscal: cnpj,
      status: 'erro',
      pdfBucket: DAS_BUCKET,
      pdfPath: '',
      source,
      errorMessage
    });
    throw badRequest(errorMessage);
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const storedFile = await uploadDasPdf({
    userId,
    competencia: resolvedCompetencia,
    pdfBuffer
  });
  const status = await resolveStatusFromSerpro(userId, cnpj, resolvedCompetencia);
  const record = await upsertDasRecord({
    userId,
    empresaId,
    competencia: resolvedCompetencia,
    documentoFiscal: cnpj,
    status,
    pdfBucket: storedFile.bucket,
    pdfPath: storedFile.path,
    source,
    errorMessage: null
  });

  return {
    ...record,
    cnpj,
    pdfBase64
  };
};

const listActiveUsersWithEmpresa = async () => {
  const supabase = getServiceRoleClient();

  const { data: certRows, error: certError } = await supabase
    .from('user_mei_certificates')
    .select('user_id, cert_document')
    .not('cert_document', 'is', null);
  if (certError) {
    throw badRequest(certError.message || 'Falha ao consultar certificados MEI');
  }

  const validUserIds = new Set(
    (certRows || [])
      .filter((row) => normalizeDoc(row.cert_document).length === 14)
      .map((row) => row.user_id)
  );

  if (validUserIds.size === 0) return [];

  const { data, error } = await supabase
    .from('role_x_user_x_empresa')
    .select('user_id, empresas_id, status')
    .eq('status', true)
    .in('user_id', Array.from(validUserIds));
  if (error) {
    throw badRequest(error.message || 'Falha ao listar usuários ativos');
  }
  const deduplicated = new Map();
  (data || []).forEach((item) => {
    if (!item?.user_id || !item?.empresas_id) return;
    deduplicated.set(`${item.user_id}:${item.empresas_id}`, {
      userId: item.user_id,
      empresaId: item.empresas_id
    });
  });
  return Array.from(deduplicated.values());
};

export const runMonthlyAutomaticDasDownload = async (referenceDate = new Date()) => {
  const competencia = getPreviousCompetencia(referenceDate);
  const users = await withRetry(() => listActiveUsersWithEmpresa(), { maxAttempts: 3, delayMs: 1000 });
  const results = [];
  const startedAt = new Date().toISOString();

  console.info('[mei-das] Iniciando processamento mensal', {
    competencia,
    totalUsuarios: users.length,
    startedAt
  });

  for (const user of users) {
    try {
      const generated = await generateAndStoreDasForUser({
        userId: user.userId,
        empresaId: user.empresaId,
        competencia,
        source: 'automatico'
      });
      results.push({
        userId: user.userId,
        empresaId: user.empresaId,
        status: 'ok',
        competencia: generated.competencia
      });
      console.info('[mei-das] Usuário processado com sucesso', {
        userId: user.userId,
        empresaId: user.empresaId,
        competencia: generated.competencia,
        status: generated.status
      });

      await trySendAutomaticDasWhatsapp({
        userId: user.userId,
        empresaId: user.empresaId,
        competencia: generated.competencia,
        periodoApuracao: competenciaToPeriodoApuracao(generated.competencia),
        cnpj: generated.cnpj,
        pdfBase64: generated.pdfBase64
      });
    } catch (error) {
      const message = error instanceof Error ? formatDasJobErrorMessage(error) : 'Falha ao gerar DAS';
      results.push({
        userId: user.userId,
        empresaId: user.empresaId,
        status: 'erro',
        message
      });
      console.warn('[mei-das] Falha no processamento do usuário', {
        userId: user.userId,
        empresaId: user.empresaId,
        competencia,
        message
      });
    }
  }

  const ok = results.filter((item) => item.status === 'ok').length;
  const erro = results.length - ok;
  const finishedAt = new Date().toISOString();
  const summary = { competencia, total: results.length, ok, erro, startedAt, finishedAt, results };
  console.info('[mei-das] Processamento mensal concluído', {
    competencia,
    total: summary.total,
    ok: summary.ok,
    erro: summary.erro,
    startedAt,
    finishedAt
  });
  return summary;
};

/**
 * Um único utilizador elegível (mesma regra do job mensal) — para testar DAS + WhatsApp sem processar todos.
 * @param {string} userId
 * @param {{ competencia?: string, referenceDate?: Date }} [options]
 */
export const runSingleUserAutomaticDasDownload = async (userId, options = {}) => {
  const uid = String(userId || '').trim();
  if (!uid) {
    throw badRequest('userId é obrigatório');
  }
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const competenciaRaw = options.competencia;
  const competencia = competenciaRaw
    ? normalizeCompetencia(String(competenciaRaw).trim())
    : getPreviousCompetencia(referenceDate);

  const users = await withRetry(() => listActiveUsersWithEmpresa(), { maxAttempts: 3, delayMs: 1000 });
  const user = users.find((u) => u.userId === uid);
  if (!user) {
    throw badRequest(
      'Usuário não está elegível: certificado MEI com CNPJ de 14 dígitos e vínculo ativo em role_x_user_x_empresa'
    );
  }

  const startedAt = new Date().toISOString();
  console.info('[mei-das] Processamento único (teste/cron)', { userId: uid, competencia, startedAt });

  try {
    const generated = await generateAndStoreDasForUser({
      userId: user.userId,
      empresaId: user.empresaId,
      competencia,
      source: 'automatico'
    });
    const whatsappStatus = await trySendAutomaticDasWhatsapp({
      userId: user.userId,
      empresaId: user.empresaId,
      competencia: generated.competencia,
      periodoApuracao: competenciaToPeriodoApuracao(generated.competencia),
      cnpj: generated.cnpj,
      pdfBase64: generated.pdfBase64
    });
    const finishedAt = new Date().toISOString();
    console.info('[mei-das] Processamento único concluído', {
      userId: uid,
      competencia: generated.competencia,
      dasStatus: generated.status,
      whatsappStatus,
      finishedAt
    });
    return {
      ok: true,
      competencia: generated.competencia,
      userId: user.userId,
      empresaId: user.empresaId,
      dasStatus: generated.status,
      whatsappStatus: whatsappStatus || 'unknown',
      startedAt,
      finishedAt
    };
  } catch (error) {
    const message = error instanceof Error ? formatDasJobErrorMessage(error) : 'Falha ao gerar DAS';
    const finishedAt = new Date().toISOString();
    console.warn('[mei-das] Processamento único falhou', {
      userId: uid,
      competencia,
      message,
      finishedAt
    });
    return {
      ok: false,
      competencia,
      userId: user.userId,
      empresaId: user.empresaId,
      message,
      whatsappStatus: 'skipped_das_failed',
      startedAt,
      finishedAt
    };
  }
};

const runSchedulerTick = async () => {
  const now = new Date();
  if (!shouldRunMonthlyJob(now)) return;
  const currentRunKey = buildCurrentRunKey(now);
  if (lastRunKey === currentRunKey) return;
  try {
    const acquired = await acquireMonthlyRunLock(currentRunKey);
    if (!acquired) {
      lastRunKey = currentRunKey;
      if (env.NODE_ENV !== 'production') {
        console.info('[mei-das] Execução mensal já registrada, ignorando tick', { currentRunKey });
      }
      return;
    }
    lastRunKey = currentRunKey;
    const summary = await runMonthlyAutomaticDasDownload(now);
    if (env.NODE_ENV !== 'production') {
      console.info('[mei-das] Job mensal executado', summary);
    }
  } catch (error) {
    console.warn('[mei-das] Falha no job mensal', error instanceof Error ? error.message : error);
  }
};

const acquireMonthlyRunLock = async (runKey) => {
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from(DAS_JOB_RUNS_TABLE)
    .insert({
      run_key: runKey,
      run_type: 'automatico',
      timezone: SCHEDULER_TIMEZONE
    });

  if (!error) return true;
  const code = String(error.code || '').trim();
  const message = String(error.message || '').toLowerCase();
  if (code === '23505' || message.includes('duplicate') || message.includes('unique')) {
    return false;
  }
  throw badRequest(error.message || 'Falha ao adquirir lock de execução mensal');
};

const isSchedulerEnabled = () => {
  return String(process.env.MEI_DAS_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
};

export const startMonthlyDasScheduler = () => {
  if (schedulerHandle) return;
  if (!isSchedulerEnabled()) {
    if (env.NODE_ENV !== 'production') {
      console.info('[mei-das] Scheduler mensal desabilitado por configuração');
    }
    return;
  }
  schedulerHandle = setInterval(() => {
    void runSchedulerTick();
  }, SCHEDULER_INTERVAL_MS);
  void runSchedulerTick();
};

const buildDasItemsForAdmin = ({ users, certRows, dasRows, competencia, statusFilter, searchTerm }) => {
  const certMap = new Map((certRows || []).map((row) => [row.user_id, normalizeDoc(row.cert_document)]));
  const dasMap = new Map((dasRows || []).map((row) => [row.user_id, row]));
  const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

  return (users || [])
    .filter((user) => user?.status !== false)
    .map((user) => {
      const cnpj = certMap.get(user.id) || '';
      const dasRow = dasMap.get(user.id);
      const resolvedStatus = cnpj.length === 14
        ? normalizeStatus(dasRow?.status || 'pendente')
        : 'erro';
      const item = {
        userId: user.id,
        displayName: user.displayName || user.email || 'Usuário sem nome',
        email: user.email || null,
        empresaId: user.empresaId || null,
        empresaName: user.empresaName || null,
        competencia,
        cnpj: cnpj || null,
        status: resolvedStatus,
        pdfBucket: dasRow?.pdf_bucket || null,
        pdfPath: dasRow?.pdf_path || null,
        hasPdf: Boolean(dasRow?.pdf_path),
        generatedAt: dasRow?.generated_at || null,
        errorMessage: dasRow?.error_message || (cnpj.length === 14 ? null : 'Certificado sem CNPJ válido')
      };
      return item;
    })
    .filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = `${item.displayName} ${item.email || ''} ${item.cnpj || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }));
};

export const listAdminCompanyDasStatus = async (accessToken, filters = {}) => {
  const competencia = normalizeCompetencia(filters.competencia) || getPreviousCompetencia();
  const statusFilter = normalizeStatusFilter(filters.status);
  const searchTerm = filters.q || '';
  const { users } = await usersService.listUsers(accessToken);
  const activeUsers = (users || []).filter((user) => user?.status !== false && user?.empresaId);

  if (activeUsers.length === 0) {
    return {
      competencia,
      totalClientes: 0,
      pendentes: 0,
      items: []
    };
  }

  const userIds = activeUsers.map((user) => user.id);
  const supabase = getServiceRoleClient();

  const [{ data: certRows, error: certError }, { data: dasRows, error: dasError }] = await Promise.all([
    supabase
      .from('user_mei_certificates')
      .select('user_id, cert_document')
      .in('user_id', userIds),
    supabase
      .from(DAS_TABLE)
      .select('user_id, competencia, status, pdf_bucket, pdf_path, generated_at, error_message')
      .eq('competencia', competencia)
      .in('user_id', userIds)
  ]);

  if (certError) {
    throw badRequest(certError.message || 'Erro ao consultar certificados MEI');
  }
  if (dasError) {
    throw badRequest(dasError.message || 'Erro ao consultar registros DAS');
  }

  const items = buildDasItemsForAdmin({
    users: activeUsers,
    certRows,
    dasRows,
    competencia,
    statusFilter,
    searchTerm
  });

  return {
    competencia,
    totalClientes: activeUsers.length,
    pendentes: items.filter((item) => item.status === 'pendente').length,
    items
  };
};

export const listAdminCompanyPendingDas = async (accessToken, competenciaInput) => {
  return listAdminCompanyDasStatus(accessToken, {
    competencia: competenciaInput,
    status: 'pendente'
  });
};

/**
 * Mensagem curta para bot/WhatsApp conforme status do DAS.
 * @param {{ status: string, display: string, hasPdf?: boolean }} input
 */
export const buildDasPaymentStatusMessage = ({ status, display, hasPdf = false }) => {
  const mes = String(display || '').trim();
  if (status === 'pago') {
    return `O DAS MEI da competência ${mes} está pago.`;
  }
  if (status === 'pendente') {
    const extra = hasPdf
      ? ' A guia PDF já está disponível; falta efetuar o pagamento.'
      : ' Ainda não há guia PDF guardada para esta competência.';
    return `O DAS MEI da competência ${mes} está pendente de pagamento.${extra}`;
  }
  if (status === 'erro') {
    return `Houve um problema ao registrar o DAS da competência ${mes}. Consulte na app Meu Financeiro.`;
  }
  return `Não foi possível confirmar o status do DAS ${mes}. Consulte na app Meu Financeiro.`;
};

/**
 * Consulta status de pagamento do DAS (tabela `das_mensal_status` + cache de competência paga).
 * @param {{ userId: string, competencia: string, refreshFromSerpro?: boolean }} input
 * competencia: `YYYY-MM` (ex. `2026-03`)
 */
export const getDasPaymentStatusForUser = async ({
  userId,
  competencia,
  refreshFromSerpro = false,
}) => {
  if (!userId) {
    throw badRequest('Usuário não informado para consulta de status do DAS');
  }
  const resolved = normalizeCompetencia(competencia);

  const supabase = getServiceRoleClient();
  const { data: row, error } = await supabase
    .from(DAS_TABLE)
    .select('status, competencia, updated_at, error_message')
    .eq('user_id', userId)
    .eq('competencia', resolved)
    .maybeSingle();

  if (error) {
    throw badRequest(error.message || 'Erro ao consultar status do DAS');
  }

  let status = row?.status ? normalizeStatus(row.status) : null;
  let statusSource = row?.status ? 'das_mensal_status' : 'none';

  if (await isCompetenciaPaid({ userId, competencia: resolved })) {
    status = 'pago';
    statusSource = 'competencia_paga';
  }

  if (refreshFromSerpro && status !== 'pago') {
    try {
      const document = await getCertificateDocument(userId);
      const cnpj = normalizeDoc(document);
      if (cnpj.length === 14) {
        const serproStatus = await resolveStatusFromSerpro(userId, cnpj, resolved);
        status = normalizeStatus(serproStatus);
        statusSource = 'serpro_periodos';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[mei-das] refreshFromSerpro ignorado', { userId, competencia: resolved, message: msg });
    }
  }

  if (!status) {
    status = 'pendente';
    if (statusSource === 'none') statusSource = 'default_pendente';
  }

  const periodoApuracao = competenciaToPeriodoApuracao(resolved);
  let hasPdf = false;
  try {
    const pdfBase64 = await getDasBase64({ userId, periodoApuracao });
    hasPdf = Boolean(pdfBase64 && String(pdfBase64).trim());
  } catch {
    hasPdf = false;
  }

  const statusLabel =
    status === 'pago' ? 'pago' : status === 'pendente' ? 'pendente de pagamento' : 'erro';

  return {
    competencia: resolved,
    status,
    statusLabel,
    hasPdf,
    statusSource,
    updatedAt: row?.updated_at ?? null,
    errorMessage: row?.error_message ?? null,
  };
};

export const reprocessDasForAdmin = async (accessToken, payload = {}) => {
  const userId = String(payload.userId || '').trim();
  if (!userId) {
    throw badRequest('Informe o userId para reprocessamento');
  }
  const competencia = normalizeCompetencia(payload.competencia) || getPreviousCompetencia();
  const canView = await usersService.canViewUser(accessToken, userId);
  if (!canView) {
    throw forbidden('Usuário fora do escopo da empresa');
  }
  const { users } = await usersService.listUsers(accessToken);
  const targetUser = (users || []).find((user) => user.id === userId);
  if (!targetUser?.empresaId) {
    throw badRequest('Empresa do usuário não encontrada para reprocessamento');
  }
  const record = await generateAndStoreDasForUser({
    userId,
    empresaId: targetUser.empresaId,
    competencia,
    source: 'manual'
  });
  console.info('[mei-das] Reprocessamento manual executado', {
    userId,
    empresaId: targetUser.empresaId,
    competencia,
    status: record.status
  });
  return {
    userId,
    competencia: record.competencia,
    status: record.status,
    pdfPath: record.pdf_path || null
  };
};
