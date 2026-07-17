import { env } from '../config/env.js';
import {
  buildAgendaReminderRunKey,
  isAgendaWhatsappRemindersEnabled,
  resolveAgendaReminderDateIso,
  runAgendaWhatsappReminders,
} from './agenda-reminders.service.js';
import { calendarDateTodayInSaoPaulo } from './calendar-events.service.js';
import { isWhatsappOutboundConfigured } from './whatsapp-outbound.service.js';
import {
  getAgendaUpcomingMinutesBefore,
  isAgendaUpcomingWhatsappEnabled,
  runAgendaUpcomingWhatsappReminders,
} from './agenda-upcoming-reminders.service.js';

const SCHEDULER_TIMEZONE = 'America/Sao_Paulo';
const MANHA_HOUR = 7;
const NOITE_HOUR = 21;
const DEFAULT_SCHEDULER_INTERVAL_MINUTES = 2;
const MIN_SCHEDULER_INTERVAL_MINUTES = 1;
const MAX_SCHEDULER_INTERVAL_MINUTES = 5;

/** @type {ReturnType<typeof setInterval> | null} */
let schedulerHandle = null;

export const getAgendaSchedulerIntervalMs = () => {
  const min = Number.parseInt(env.AGENDA_SCHEDULER_INTERVAL_MINUTES || '', 10);
  if (
    Number.isFinite(min)
    && min >= MIN_SCHEDULER_INTERVAL_MINUTES
    && min <= MAX_SCHEDULER_INTERVAL_MINUTES
  ) {
    return min * 60_000;
  }
  return DEFAULT_SCHEDULER_INTERVAL_MINUTES * 60_000;
};

/** runKey já disparado neste processo (ex.: agenda:manha:2026-05-27) */
const firedRunKeys = new Set();

/**
 * @param {Date} [date]
 * @returns {{ hour: number, minute: number, dateIso: string }}
 */
export const getAgendaSchedulerClockInSaoPaulo = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULER_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const dateIso = calendarDateTodayInSaoPaulo();
  return { hour, minute, dateIso };
};

/**
 * Janela de 5 min no início da hora (alinhado ao tick do scheduler).
 * @param {number} hour
 * @param {number} minute
 * @param {number} targetHour
 */
export const isAgendaSchedulerWindow = (hour, minute, targetHour) =>
  hour === targetHour && minute < 5;

/**
 * @param {number} hour
 * @param {number} minute
 * @returns {'manha'|'noite'|null}
 */
export const resolveAgendaSlotForSchedulerTick = (hour, minute) => {
  if (isAgendaSchedulerWindow(hour, minute, MANHA_HOUR)) return 'manha';
  if (isAgendaSchedulerWindow(hour, minute, NOITE_HOUR)) return 'noite';
  return null;
};

export const isAgendaRemindersSchedulerEnabled = () => {
  const explicit = String(env.AGENDA_WHATSAPP_SCHEDULER_ENABLED || '').trim();
  if (explicit) {
    return explicit.toLowerCase() === 'true';
  }
  return isAgendaWhatsappRemindersEnabled() || isAgendaUpcomingWhatsappEnabled();
};

const runSchedulerTick = async () => {
  if (!isAgendaRemindersSchedulerEnabled()) {
    return;
  }

  if (isAgendaUpcomingWhatsappEnabled()) {
    try {
      await runAgendaUpcomingWhatsappReminders();
    } catch (err) {
      console.warn(
        '[agenda-upcoming] scheduler falhou',
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (!isAgendaWhatsappRemindersEnabled()) {
    return;
  }

  const { hour, minute } = getAgendaSchedulerClockInSaoPaulo();
  const slot = resolveAgendaSlotForSchedulerTick(hour, minute);
  if (!slot) return;

  const dateIso = resolveAgendaReminderDateIso(slot);
  const runKey = buildAgendaReminderRunKey(slot, dateIso);
  if (firedRunKeys.has(runKey)) return;

  firedRunKeys.add(runKey);
  try {
    const summary = await runAgendaWhatsappReminders({ slot, dateIso });
    console.info('[agenda-reminders] scheduler', {
      slot,
      dateIso,
      sent: summary.sent,
      skipped: summary.skipped,
      total: summary.total,
    });
  } catch (err) {
    firedRunKeys.delete(runKey);
    console.warn(
      '[agenda-reminders] scheduler falhou',
      err instanceof Error ? err.message : err,
    );
  }
};

export const startAgendaRemindersScheduler = () => {
  if (schedulerHandle) return;
  if (!isAgendaRemindersSchedulerEnabled()) {
    console.info('[agenda-reminders] Scheduler interno desligado');
    return;
  }
  const dailyOn = isAgendaWhatsappRemindersEnabled();
  const upcomingOn = isAgendaUpcomingWhatsappEnabled();
  if (!dailyOn && !upcomingOn) {
    console.info(
      '[agenda-reminders] Scheduler ignorado — defina AGENDA_WHATSAPP_REMINDERS_ENABLED=true '
      + 'ou AGENDA_UPCOMING_WHATSAPP_ENABLED=true',
    );
    return;
  }
  if (upcomingOn && !isWhatsappOutboundConfigured()) {
    console.warn(
      '[agenda-upcoming] lembretes activos mas WhatsApp outbound não configurado (Z-API ou n8n)',
    );
  }

  const dailyLabel = dailyOn ? `${MANHA_HOUR}h e ${NOITE_HOUR}h` : 'desligado';
  const upcomingLabel = upcomingOn ? `lembretes ~${getAgendaUpcomingMinutesBefore()}min` : 'desligado';
  const tickMin = getAgendaSchedulerIntervalMs() / 60_000;
  console.info(
    `[agenda-reminders] Scheduler interno ativo (tick ${tickMin}min · ${dailyLabel} + ${upcomingLabel} ${SCHEDULER_TIMEZONE})`,
  );
  const intervalMs = getAgendaSchedulerIntervalMs();
  schedulerHandle = setInterval(() => {
    void runSchedulerTick();
  }, intervalMs);
  void runSchedulerTick();
};
