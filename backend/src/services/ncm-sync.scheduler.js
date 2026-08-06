import { env } from '../config/env.js';
import {
  ensureNcmCatalogSynced,
  ensureNcmTableSchema,
  syncNcmCatalogFromBrasilApi,
} from './ncm-catalog.service.js';

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULER_HOUR = 3;
const SCHEDULER_TIMEZONE = 'America/Sao_Paulo';

/** @type {ReturnType<typeof setInterval> | null} */
let schedulerHandle = null;
/** @type {string | null} */
let lastMonthlyRunKey = null;

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

const isEnabled = () => parseBoolean(env.NCM_SYNC_ENABLED, true);

const getSaoPauloDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULER_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
  };
};

const buildMonthlyRunKey = (date = new Date()) => {
  const { year, month } = getSaoPauloDateParts(date);
  return `ncm-sync-${year}-${String(month).padStart(2, '0')}`;
};

const shouldRunMonthlyNcmSync = (date = new Date()) => {
  const { day, hour } = getSaoPauloDateParts(date);
  return day === 1 && hour >= SCHEDULER_HOUR;
};

const runMonthlyNcmSyncTick = async () => {
  const now = new Date();
  if (!shouldRunMonthlyNcmSync(now)) return;

  const runKey = buildMonthlyRunKey(now);
  if (lastMonthlyRunKey === runKey) return;

  lastMonthlyRunKey = runKey;
  try {
    await ensureNcmTableSchema();
    const result = await syncNcmCatalogFromBrasilApi();
    // eslint-disable-next-line no-console
    console.info('[ncm-sync] job mensal concluído', { runKey, total: result.total });
  } catch (error) {
    lastMonthlyRunKey = null;
    // eslint-disable-next-line no-console
    console.warn('[ncm-sync] falha no job mensal:', error?.message || error);
  }
};

/** Dispara sync em background na subida + verifica job mensal (dia 1, 03h SP). */
export const startNcmCatalogSyncScheduler = () => {
  if (!isEnabled()) return;
  if (process.env.VERCEL === '1') return;

  void ensureNcmTableSchema()
    .then(() => ensureNcmCatalogSynced())
    .then((result) => {
      if (result.skipped) {
        // eslint-disable-next-line no-console
        console.info('[ncm-sync] catálogo local OK —', result.count, 'registros');
        return;
      }
      // eslint-disable-next-line no-console
      console.info('[ncm-sync] sincronizado', result.total, 'NCMs via BrasilAPI');
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[ncm-sync] falha na sincronização inicial:', error?.message || error);
    });

  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runMonthlyNcmSyncTick();
  }, SCHEDULER_INTERVAL_MS);
  void runMonthlyNcmSyncTick();
};
