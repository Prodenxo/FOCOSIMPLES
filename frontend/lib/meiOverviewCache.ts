import type { MeiPeriod, ParcelamentoItem } from '../services/guidesMeiService';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { data: T; at: number };

type OverviewBucket = {
  periods?: CacheEntry<MeiPeriod[]>;
  parcelamentos?: CacheEntry<ParcelamentoItem[]>;
};

const store = new Map<string, OverviewBucket>();

const keyFor = (cnpj: string) => String(cnpj || '').replace(/\D/g, '');

const isFresh = <T>(entry?: CacheEntry<T>): entry is CacheEntry<T> =>
  Boolean(entry && Date.now() - entry.at < TTL_MS);

export function readMeiOverviewPeriods(cnpj: string): MeiPeriod[] | null {
  const bucket = store.get(keyFor(cnpj));
  if (!isFresh(bucket?.periods)) return null;
  return bucket.periods.data;
}

export function readMeiOverviewParcelamentos(cnpj: string): ParcelamentoItem[] | null {
  const bucket = store.get(keyFor(cnpj));
  if (!isFresh(bucket?.parcelamentos)) return null;
  return bucket.parcelamentos.data;
}

export function writeMeiOverviewPeriods(cnpj: string, data: MeiPeriod[]) {
  const k = keyFor(cnpj);
  const prev = store.get(k) || {};
  store.set(k, { ...prev, periods: { data, at: Date.now() } });
}

export function writeMeiOverviewParcelamentos(cnpj: string, data: ParcelamentoItem[]) {
  const k = keyFor(cnpj);
  const prev = store.get(k) || {};
  store.set(k, { ...prev, parcelamentos: { data, at: Date.now() } });
}

export function clearMeiOverviewCache(cnpj?: string) {
  if (!cnpj) {
    store.clear();
    return;
  }
  store.delete(keyFor(cnpj));
}
