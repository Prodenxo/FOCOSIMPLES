import { env } from '../config/env.js';
import { createSupabaseClient } from '../config/supabase.js';
import { badRequest } from '../utils/errors.js';
import {
  fetchOpenclawNfsePdfBase64,
  isNfsePdfReadyStatus,
} from './openclaw-nfse.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const MEI_NFSE_TABLE = 'mei_nfse';
const DOCUMENT_TYPE_NFSE = 'NFSE';
const MAX_BATCH = 40;
const MAX_DELIVERY_ATTEMPTS = 36;
const MAX_PENDING_AGE_MS = 72 * 60 * 60 * 1000;

export const OPENCLAW_NFSE_META = {
  SOURCE: 'source',
  PHONE: 'openclawWhatsappPhone',
  PENDING: 'openclawWhatsappPdfPending',
  SENT_AT: 'openclawWhatsappPdfSentAt',
  SENDING_AT: 'openclawWhatsappPdfSendingAt',
  ATTEMPTS: 'openclawWhatsappPdfAttempts',
  LAST_ERROR: 'openclawWhatsappPdfLastError',
  REQUESTED_AT: 'openclawWhatsappPdfRequestedAt',
};

const SENDING_CLAIM_MAX_MS = 3 * 60 * 1000;

const TERMINAL_FAILURE_STATUSES = new Set(['rejeitado', 'cancelado', 'erro']);

/** Evita reentrância obterNota(sync) → entrega → consult → obterNota. */
const deliveryInFlight = new Set();

/** Timers de retry in-process após emit_nfse (complementa o cron). */
const scheduledRetryTimers = new Map();

const RETRY_DELAYS_MS = [5_000, 12_000, 25_000, 45_000, 90_000, 180_000];

const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
);

export const isOpenclawNfseAutoWhatsappEnabled = () => {
  const raw = process.env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED
    ?? env.OPENCLAW_NFSE_AUTO_WHATSAPP_ENABLED;
  return String(raw || '').toLowerCase() === 'true';
};

const getAdmin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }
  return createSupabaseClient({ useServiceRole: true });
};

const normalizePhone55 = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
};

const mergeNotaMetadata = async (userId, notaId, patch) => {
  const admin = getAdmin();
  const { data: row, error: readErr } = await admin
    .from(MEI_NFSE_TABLE)
    .select('metadata_json')
    .eq('id', notaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) throw badRequest(readErr.message);
  if (!row) throw badRequest('Nota fiscal não encontrada');

  const merged = { ...toObject(row.metadata_json), ...patch };
  const { error: writeErr } = await admin
    .from(MEI_NFSE_TABLE)
    .update({
      metadata_json: Object.keys(merged).length ? merged : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notaId)
    .eq('user_id', userId);
  if (writeErr) throw badRequest(writeErr.message);
  return merged;
};

/**
 * Marca nota emitida pelo OpenClaw para entrega automática de PDF (cron Z-API).
 */
export const getOpenclawNfseWhatsappDeliveryState = async (userId, notaId) => {
  if (!userId || !notaId) {
    return { pending: false, sentAt: null, alreadySent: false };
  }
  const admin = getAdmin();
  const { data: row } = await admin
    .from(MEI_NFSE_TABLE)
    .select('metadata_json')
    .eq('id', notaId)
    .eq('user_id', userId)
    .maybeSingle();
  const meta = toObject(row?.metadata_json);
  const sentAt = meta[OPENCLAW_NFSE_META.SENT_AT] || null;
  return {
    pending: meta[OPENCLAW_NFSE_META.PENDING] === true,
    sentAt,
    alreadySent: Boolean(sentAt),
  };
};

export const registerOpenclawNfseWhatsappDelivery = async (userId, notaId, phone) => {
  const normalizedPhone = normalizePhone55(phone);
  if (!userId || !notaId || !normalizedPhone) return null;

  const now = new Date().toISOString();
  return mergeNotaMetadata(userId, notaId, {
    [OPENCLAW_NFSE_META.SOURCE]: 'openclaw_whatsapp',
    [OPENCLAW_NFSE_META.PHONE]: normalizedPhone,
    [OPENCLAW_NFSE_META.PENDING]: true,
    [OPENCLAW_NFSE_META.REQUESTED_AT]: now,
    [OPENCLAW_NFSE_META.ATTEMPTS]: 0,
    [OPENCLAW_NFSE_META.LAST_ERROR]: null,
  });
};

export const markOpenclawNfseWhatsappSent = async (userId, notaId, { channel = 'zapi' } = {}) => {
  if (!userId || !notaId) return null;
  const now = new Date().toISOString();
  return mergeNotaMetadata(userId, notaId, {
    [OPENCLAW_NFSE_META.PENDING]: false,
    [OPENCLAW_NFSE_META.SENT_AT]: now,
    [OPENCLAW_NFSE_META.SENDING_AT]: null,
    [OPENCLAW_NFSE_META.LAST_ERROR]: null,
    openclawWhatsappPdfSentChannel: channel,
  });
};

const markOpenclawNfseWhatsappFailed = async (userId, notaId, message, { clearPending = false } = {}) => {
  const admin = getAdmin();
  const { data: row } = await admin
    .from(MEI_NFSE_TABLE)
    .select('metadata_json')
    .eq('id', notaId)
    .eq('user_id', userId)
    .maybeSingle();
  const meta = toObject(row?.metadata_json);
  const attempts = Number(meta[OPENCLAW_NFSE_META.ATTEMPTS] || 0) + 1;
  return mergeNotaMetadata(userId, notaId, {
    [OPENCLAW_NFSE_META.ATTEMPTS]: attempts,
    [OPENCLAW_NFSE_META.LAST_ERROR]: String(message || '').slice(0, 500),
    ...(clearPending ? { [OPENCLAW_NFSE_META.PENDING]: false } : {}),
  });
};

const normalizeStatusKey = (status) => {
  const ascii = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (ascii.includes('rejeit')) return 'rejeitado';
  if (ascii.includes('cancel')) return 'cancelado';
  if (ascii.includes('concluid') || ascii.includes('autoriz')) return 'concluido';
  if (ascii.includes('process')) return 'processando';
  if (ascii.includes('erro') || ascii.includes('falha')) return 'erro';
  return ascii || 'processando';
};

const listPendingDeliveries = async () => {
  const admin = getAdmin();
  const { data, error } = await admin
    .from(MEI_NFSE_TABLE)
    .select('id, user_id, status, metadata_json, created_at')
    .eq('document_type', DOCUMENT_TYPE_NFSE)
    .is('archived_at', null)
    .contains('metadata_json', { [OPENCLAW_NFSE_META.PENDING]: true })
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH);
  if (error) throw badRequest(error.message);
  return (data || []).filter((row) => {
    const meta = toObject(row.metadata_json);
    const phone = normalizePhone55(meta[OPENCLAW_NFSE_META.PHONE]);
    return Boolean(phone && meta[OPENCLAW_NFSE_META.PENDING] === true);
  });
};

const isPendingExpired = (row) => {
  const meta = toObject(row?.metadata_json);
  const requestedAt = meta[OPENCLAW_NFSE_META.REQUESTED_AT] || row?.created_at;
  const ts = Date.parse(String(requestedAt || ''));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts > MAX_PENDING_AGE_MS;
};

const isOpenclawWhatsappPdfAlreadySent = (meta) =>
  Boolean(meta?.[OPENCLAW_NFSE_META.SENT_AT]);

const isOpenclawWhatsappPdfSending = (meta) => {
  const at = meta?.[OPENCLAW_NFSE_META.SENDING_AT];
  if (!at) return false;
  const ts = Date.parse(String(at));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < SENDING_CLAIM_MAX_MS;
};

/** Reserva envio (evita duplicar Z-API + mf-nfse-send em paralelo). */
const claimOpenclawNfseWhatsappDeliverySlot = async (userId, notaId) => {
  const admin = getAdmin();
  const { data: row, error } = await admin
    .from(MEI_NFSE_TABLE)
    .select('metadata_json')
    .eq('id', notaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!row) return { ok: false, reason: 'not_found' };

  const meta = toObject(row.metadata_json);
  if (isOpenclawWhatsappPdfAlreadySent(meta)) {
    return { ok: false, reason: 'already_sent' };
  }
  if (isOpenclawWhatsappPdfSending(meta)) {
    return { ok: false, reason: 'sending_in_progress' };
  }

  await mergeNotaMetadata(userId, notaId, {
    [OPENCLAW_NFSE_META.SENDING_AT]: new Date().toISOString(),
  });
  return { ok: true };
};

const trySendNfsePdfZapi = async ({ userId, phone, pdfBase64, fileName, notaId }) => {
  if (!isWhatsappOutboundConfigured()) {
    return { whatsappStatus: 'skipped_no_whatsapp' };
  }
  try {
    const result = await sendWhatsappMessage({
      phone,
      pdfBase64,
      fileName,
      message: 'Segue a NFSe emitida.',
      source: 'openclaw_nfse_auto',
      userId,
      notaId,
    });
    return { whatsappStatus: 'sent', channel: result?.channel || 'zapi' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { whatsappStatus: 'failed', whatsappError: msg };
  }
};

/**
 * Obtém PDF (sync Plugnotas) e envia via Z-API/n8n outbound.
 */
export const deliverOpenclawNfseWhatsappPdf = async (userId, notaId, phone) => {
  const normalizedPhone = normalizePhone55(phone);
  if (!normalizedPhone) {
    return { whatsappStatus: 'skipped_no_phone', notaId };
  }

  const claim = await claimOpenclawNfseWhatsappDeliverySlot(userId, notaId);
  if (!claim.ok) {
    return { whatsappStatus: claim.reason, notaId };
  }

  try {
    const pdfResult = await fetchOpenclawNfsePdfBase64(userId, { id: notaId, sync: true });
    const whatsapp = await trySendNfsePdfZapi({
      userId,
      phone: normalizedPhone,
      pdfBase64: pdfResult.base64,
      fileName: pdfResult.fileName,
      notaId,
    });

    if (whatsapp.whatsappStatus === 'sent') {
      await markOpenclawNfseWhatsappSent(userId, notaId, { channel: whatsapp.channel });
      clearScheduledRetries(userId, notaId);
      return {
        ...whatsapp,
        notaId,
        fileName: pdfResult.fileName,
      };
    }

    await markOpenclawNfseWhatsappFailed(
      userId,
      notaId,
      whatsapp.whatsappError || whatsapp.whatsappStatus,
    );
    await mergeNotaMetadata(userId, notaId, {
      [OPENCLAW_NFSE_META.SENDING_AT]: null,
    });
    return { ...whatsapp, notaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markOpenclawNfseWhatsappFailed(userId, notaId, message);
    await mergeNotaMetadata(userId, notaId, {
      [OPENCLAW_NFSE_META.SENDING_AT]: null,
    });
    return { whatsappStatus: 'error', whatsappError: message, notaId };
  }
};

const clearScheduledRetries = (userId, notaId) => {
  const key = `${userId}:${notaId}`;
  const timers = scheduledRetryTimers.get(key);
  if (!timers) return;
  timers.forEach((timer) => clearTimeout(timer));
  scheduledRetryTimers.delete(key);
};

/**
 * Tenta entregar PDF pendente para uma nota (após sync ou cron).
 * @returns {Promise<object|null>}
 */
export const tryDeliverPendingOpenclawNfseIfReady = async (userId, record) => {
  if (!isOpenclawNfseAutoWhatsappEnabled() || !isWhatsappOutboundConfigured()) {
    return null;
  }
  if (!userId || !record?.id) return null;

  const meta = toObject(record.metadata_json);
  if (meta[OPENCLAW_NFSE_META.PENDING] !== true) return null;
  if (isOpenclawWhatsappPdfAlreadySent(meta)) return null;

  const phone = normalizePhone55(meta[OPENCLAW_NFSE_META.PHONE]);
  if (!phone) return null;

  const key = `${userId}:${record.id}`;
  if (deliveryInFlight.has(key)) return null;
  deliveryInFlight.add(key);

  try {
    if (isNfsePdfReadyStatus(record.status)) {
      const delivered = await deliverOpenclawNfseWhatsappPdf(userId, record.id, phone);
      const result = {
        notaId: record.id,
        userId,
        status: delivered.whatsappStatus === 'sent' ? 'sent' : delivered.whatsappStatus,
        whatsappError: delivered.whatsappError ?? null,
      };
      if (result.status === 'sent') {
        clearScheduledRetries(userId, record.id);
      }
      return result;
    }

    const row = {
      id: record.id,
      user_id: userId,
      status: record.status,
      metadata_json: record.metadata_json,
      created_at: record.created_at,
    };
    const result = await processPendingRow(row);
    if (result.status === 'sent') {
      clearScheduledRetries(userId, record.id);
    }
    return result;
  } finally {
    deliveryInFlight.delete(key);
  }
};

/**
 * Após emit_nfse com nota ainda em processamento: tenta enviar PDF sem depender só do cron externo.
 */
export const scheduleOpenclawNfseWhatsappDeliveryRetries = (userId, notaId) => {
  if (!isOpenclawNfseAutoWhatsappEnabled()) return;
  if (!userId || !notaId) return;

  clearScheduledRetries(userId, notaId);
  const key = `${userId}:${notaId}`;

  const timers = RETRY_DELAYS_MS.map((delayMs) =>
    setTimeout(() => {
      void (async () => {
        try {
          const admin = getAdmin();
          const { data: row, error } = await admin
            .from(MEI_NFSE_TABLE)
            .select('id, user_id, status, metadata_json, created_at')
            .eq('id', notaId)
            .eq('user_id', userId)
            .maybeSingle();
          if (error || !row) {
            clearScheduledRetries(userId, notaId);
            return;
          }
          const meta = toObject(row.metadata_json);
          if (meta[OPENCLAW_NFSE_META.PENDING] !== true) {
            clearScheduledRetries(userId, notaId);
            return;
          }
          const result = await processPendingRow(row);
          if (
            result.status === 'sent'
            || result.status === 'expired'
            || result.status === 'max_attempts'
            || TERMINAL_FAILURE_STATUSES.has(result.status)
          ) {
            clearScheduledRetries(userId, notaId);
          }
        } catch (err) {
          console.warn('[nfse-whatsapp-delivery] retry agendado falhou', {
            notaId,
            userId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }, delayMs),
  );

  scheduledRetryTimers.set(key, timers);
};

const processPendingRow = async (row) => {
  const userId = row.user_id;
  const notaId = row.id;
  const meta = toObject(row.metadata_json);
  const phone = normalizePhone55(meta[OPENCLAW_NFSE_META.PHONE]);
  const attempts = Number(meta[OPENCLAW_NFSE_META.ATTEMPTS] || 0);

  if (isOpenclawWhatsappPdfAlreadySent(meta)) {
    return { notaId, userId, status: 'already_sent' };
  }

  if (isPendingExpired(row)) {
    await markOpenclawNfseWhatsappFailed(userId, notaId, 'pending_expired_72h', { clearPending: true });
    return { notaId, userId, status: 'expired' };
  }

  if (attempts >= MAX_DELIVERY_ATTEMPTS) {
    await markOpenclawNfseWhatsappFailed(userId, notaId, 'max_attempts', { clearPending: true });
    return { notaId, userId, status: 'max_attempts' };
  }

  let noteStatus = row.status;
  try {
    const { obterNota } = await import('./mei-notas.service.js');
    const synced = await obterNota(userId, notaId, { sync: true, skipWhatsappDelivery: true });
    noteStatus = synced.status;
    if (!isNfsePdfReadyStatus(noteStatus)) {
      const statusKey = normalizeStatusKey(noteStatus);
      if (TERMINAL_FAILURE_STATUSES.has(statusKey)) {
        await markOpenclawNfseWhatsappFailed(userId, notaId, `nota_${statusKey}`, { clearPending: true });
        return { notaId, userId, status: statusKey };
      }
      return { notaId, userId, status: 'waiting', noteStatus };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err?.errors?.code || err?.code;
    if (code === 'NFSE_PDF_NOT_READY') {
      return { notaId, userId, status: 'waiting', noteStatus };
    }
    await markOpenclawNfseWhatsappFailed(userId, notaId, message);
    return { notaId, userId, status: 'error', message };
  }

  const statusKey = normalizeStatusKey(noteStatus);
  if (TERMINAL_FAILURE_STATUSES.has(statusKey)) {
    await markOpenclawNfseWhatsappFailed(userId, notaId, `nota_${statusKey}`, { clearPending: true });
    return { notaId, userId, status: statusKey };
  }

  if (!isNfsePdfReadyStatus(noteStatus)) {
    return { notaId, userId, status: 'waiting', noteStatus };
  }

  const result = await deliverOpenclawNfseWhatsappPdf(userId, notaId, phone);
  return {
    notaId,
    userId,
    status: result.whatsappStatus,
    whatsappError: result.whatsappError ?? null,
  };
};

/**
 * Cron: entrega PDF NFSe OpenClaw pendentes (Z-API directo, sem n8n).
 */
export const runOpenclawNfseWhatsappDeliveryJob = async () => {
  const startedAt = new Date().toISOString();
  if (!isOpenclawNfseAutoWhatsappEnabled()) {
    return {
      ok: true,
      skipped: 'disabled',
      startedAt,
      finishedAt: new Date().toISOString(),
      total: 0,
      results: [],
    };
  }

  if (!isWhatsappOutboundConfigured()) {
    return {
      ok: false,
      skipped: 'no_whatsapp_outbound',
      startedAt,
      finishedAt: new Date().toISOString(),
      total: 0,
      results: [],
    };
  }

  const rows = await listPendingDeliveries();
  const results = [];
  for (const row of rows) {
    try {
      results.push(await processPendingRow(row));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[nfse-whatsapp-delivery] falha nota', {
        notaId: row.id,
        userId: row.user_id,
        message,
      });
      try {
        await markOpenclawNfseWhatsappFailed(row.user_id, row.id, message);
      } catch {
        /* ignore */
      }
      results.push({
        notaId: row.id,
        userId: row.user_id,
        status: 'error',
        message,
      });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const waiting = results.filter((r) => r.status === 'waiting').length;

  return {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    total: rows.length,
    sent,
    waiting,
    results,
  };
};
