import { env } from '../config/env.js';
import { ensureNcmCatalogSynced, ensureNcmTableSchema } from './ncm-catalog.service.js';

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

const isEnabled = () => parseBoolean(env.NCM_SYNC_ENABLED, true);

/** Dispara sync em background na subida do servidor (não bloqueia HTTP). */
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
};
