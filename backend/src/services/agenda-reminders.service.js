import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { env } from '../config/env.js';
import { createSupabaseClient } from '../config/supabase.js';
import { resolveOpenclawWhatsappPhone } from './openclaw-bot.service.js';
import {
  calendarDateAddDaysInSaoPaulo,
  calendarDateTodayInSaoPaulo,
  listAgendaChecklistForUser,
  listCalendarEventsForUser,
} from './calendar-events.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const VALID_SLOTS = new Set(['manha', 'noite']);

/** Evita dois lotes em paralelo (vários GET do agendador com 202). */
let agendaReminderBatchPromise = null;

/** Dedup em memória (reinício do contentor limpa — complementado por ficheiro em /tmp). */
const memoryBatchDone = new Map();

const BATCH_TTL_MS = 22 * 60 * 60 * 1000;

/**
 * @param {'manha'|'noite'} slot
 * @param {string} dateIso YYYY-MM-DD
 */
export const buildAgendaReminderRunKey = (slot, dateIso) =>
  `agenda:${slot}:${dateIso}`;

export const isAgendaReminderBatchInFlight = () => !!agendaReminderBatchPromise;

/**
 * @param {string} runKey
 * @param {boolean} force
 */
export const tryAcquireAgendaReminderBatchMemory = (runKey, force) => {
  if (force) return true;
  const prev = memoryBatchDone.get(runKey);
  if (prev && Date.now() - prev < BATCH_TTL_MS) return false;
  for (const [key, ts] of memoryBatchDone) {
    if (Date.now() - ts >= BATCH_TTL_MS) memoryBatchDone.delete(key);
  }
  return true;
};

/**
 * @param {string} runKey
 */
export const markAgendaReminderBatchDone = (runKey) => {
  memoryBatchDone.set(runKey, Date.now());
};

/**
 * Lock em ficheiro (sem Supabase) — sobrevive a hot reload se /tmp persistir.
 * @param {string} runKey
 * @param {boolean} force
 */
export const tryAcquireAgendaReminderBatchFile = (runKey, force) => {
  if (force) return true;
  const safe = runKey.replace(/[^a-z0-9_-]/gi, '_');
  const file = path.join(os.tmpdir(), `mf-agenda-batch-${safe}.lock`);
  try {
    fs.writeFileSync(file, `${new Date().toISOString()}\n`, { flag: 'wx', encoding: 'utf8' });
    return true;
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'EEXIST') return false;
    return true;
  }
};

/**
 * Data consultada na agenda: manhã = hoje; noite = amanhã (fuso São Paulo).
 * @param {'manha'|'noite'} slot
 * @param {string} [explicitDateIso] override YYYY-MM-DD (query `date`)
 */
export const resolveAgendaReminderDateIso = (slot, explicitDateIso) => {
  const override = String(explicitDateIso || '').trim();
  if (override) return override;
  if (slot === 'noite') return calendarDateAddDaysInSaoPaulo(1);
  return calendarDateTodayInSaoPaulo();
};

export const isAgendaWhatsappRemindersEnabled = () =>
  String(env.AGENDA_WHATSAPP_REMINDERS_ENABLED || '').toLowerCase() === 'true';

export const listUsersWithWhatsappLink = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }
  const admin = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await admin
    .from('n8n_link')
    .select('user_id, user_number')
    .not('user_id', 'is', null)
    .not('user_number', 'is', null);
  if (error) throw new Error(error.message);
  const seenUsers = new Set();
  const seenPhones = new Set();
  const out = [];
  for (const row of data || []) {
    const userId = String(row.user_id || '').trim();
    if (!userId || seenUsers.has(userId)) continue;
    const phone = resolveOpenclawWhatsappPhone(row.user_number, row.user_number);
    if (!phone) continue;
    if (seenPhones.has(phone)) continue;
    seenUsers.add(userId);
    seenPhones.add(phone);
    out.push({ userId, phone });
  }
  return out;
};

/**
 * Mensagem WhatsApp só quando há compromissos; caso contrário `null` (não enviar).
 * @param {{ events?: Array<{ title?: string, time?: string|null, allDay?: boolean }>, dateDisplay?: string }} calendar
 * @param {'manha'|'noite'} slot
 */
export const formatAgendaReminderWhatsappMessage = (checklist, slot = 'manha') => {
  if (!checklist?.events?.length) return null;
  const greeting = slot === 'noite' ? 'Boa noite' : 'Bom dia';
  const dayWord = slot === 'noite' ? 'amanhã' : 'hoje';
  return `${greeting}! Compromissos de ${dayWord}:\n\n${checklist.message}`;
};

const trySendAgendaReminder = async ({ userId, phone, message, slot, dateIso }) => {
  if (!isWhatsappOutboundConfigured()) return 'skipped_no_whatsapp';
  if (!phone || !message) return 'skipped_no_message';

  const payload = {
    userId,
    phone,
    message,
    source: slot === 'noite' ? 'agenda_reminder_noite' : 'agenda_reminder_manha',
    date: dateIso,
  };
  try {
    await sendWhatsappMessage(payload);
    return 'sent';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[agenda-reminders] falha WhatsApp', { userId, message: msg });
    return 'failed';
  }
};

const runAgendaWhatsappRemindersInner = async (options) => {
  const slot = VALID_SLOTS.has(options.slot) ? options.slot : 'manha';
  const dateIso = resolveAgendaReminderDateIso(slot, options.dateIso);
  const startedAt = new Date().toISOString();

  const users = await listUsersWithWhatsappLink();
  const results = [];

  for (const { userId, phone } of users) {
    try {
      const checklist = await listAgendaChecklistForUser(userId, { date: dateIso, data: dateIso });
      if (checklist.empty || !checklist.events?.length) {
        results.push({
          userId,
          status: 'skipped_empty',
          count: 0,
        });
        continue;
      }

      const message = formatAgendaReminderWhatsappMessage(checklist, slot);
      if (!message) {
        results.push({
          userId,
          status: 'skipped_empty',
          count: 0,
        });
        continue;
      }

      const whatsappStatus = await trySendAgendaReminder({
        userId,
        phone,
        message,
        slot,
        dateIso,
      });
      results.push({
        userId,
        status: whatsappStatus === 'sent' ? 'sent' : whatsappStatus,
        count: checklist.count,
        whatsappStatus,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[agenda-reminders] utilizador ignorado', { userId, msg });
      results.push({
        userId,
        status: 'error',
        message: msg,
      });
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const skippedEmpty = results.filter((r) => r.status === 'skipped_empty').length;
  const finishedAt = new Date().toISOString();

  console.info('[agenda-reminders] lote concluído', {
    slot,
    dateIso,
    total: users.length,
    sent,
    skippedEmpty,
    startedAt,
    finishedAt,
  });

  return {
    ok: true,
    slot,
    dateIso,
    startedAt,
    finishedAt,
    total: users.length,
    sent,
    skippedEmpty,
    failed: results.filter((r) => r.status === 'failed').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  };
};

/**
 * Percorre utilizadores com telefone em `n8n_link`; envia WhatsApp só quem tiver eventos no dia alvo.
 * Dedup sem BD: memória + lock em /tmp + single-flight.
 * @param {{ slot?: 'manha'|'noite', dateIso?: string, force?: boolean }} [options]
 */
export const runAgendaWhatsappReminders = async (options = {}) => {
  const slot = VALID_SLOTS.has(options.slot) ? options.slot : 'manha';
  const dateIso = resolveAgendaReminderDateIso(slot, options.dateIso);
  const force = options.force === true;
  const runKey = buildAgendaReminderRunKey(slot, dateIso);
  const startedAt = new Date().toISOString();

  if (!isAgendaWhatsappRemindersEnabled()) {
    return {
      ok: true,
      skipped: 'disabled',
      slot,
      dateIso,
      startedAt,
      finishedAt: new Date().toISOString(),
      message:
        'Lembretes de agenda desligados (AGENDA_WHATSAPP_REMINDERS_ENABLED≠true).',
    };
  }

  if (!force) {
    if (!tryAcquireAgendaReminderBatchMemory(runKey, force)) {
      return {
        ok: true,
        skipped: 'batch_already_ran',
        dedup: 'memory',
        slot,
        dateIso,
        runKey,
        startedAt,
        finishedAt: new Date().toISOString(),
        message:
          'Lote já executado neste processo para este slot/dia. Use ?force=1 só em teste.',
      };
    }
    if (!tryAcquireAgendaReminderBatchFile(runKey, force)) {
      return {
        ok: true,
        skipped: 'batch_already_ran',
        dedup: 'file',
        slot,
        dateIso,
        runKey,
        startedAt,
        finishedAt: new Date().toISOString(),
        message:
          'Lote já executado hoje (lock em /tmp). Use ?force=1 só em teste.',
      };
    }
  }

  if (agendaReminderBatchPromise && !force) {
    return agendaReminderBatchPromise;
  }

  const work = (async () => {
    const summary = await runAgendaWhatsappRemindersInner({ slot, dateIso });
    if (!force && summary.ok && !summary.skipped) {
      markAgendaReminderBatchDone(runKey);
    }
    return summary;
  })();

  agendaReminderBatchPromise = work;
  try {
    return await work;
  } finally {
    if (agendaReminderBatchPromise === work) {
      agendaReminderBatchPromise = null;
    }
  }
};
