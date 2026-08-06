/**
 * Integração IBPT (De Olho no Imposto) — Lei 12.741/2012.
 * @see https://deolhonoimposto.ibpt.org.br/
 */

import { Client } from 'pg';
import { env, normalizeEnvSecret } from '../config/env.js';
import { IBPT_NCM_CACHE_SCHEMA_SQL } from './db-bootstrap.service.js';

/** API v2 oficial IBPT (substitui apidoni.ibpt.org.br). */
export const IBPT_API_URL = 'https://apiv2.ibpt.org.br/api/v1/produtos';
const IBPT_FETCH_TIMEOUT_MS_DEFAULT = 3000;
const IBPT_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const DB_CACHE_MAX_AGE_DAYS = 30;
const DEFAULT_GTIN = 'SEM GTIN';
const DEFAULT_EX = '0';

/** @type {Map<string, { data: IbptAliquotas, expiresAt: number }>} */
const memoryCache = new Map();

/** @type {Promise<{ ok: boolean }> | null} */
let schemaEnsureInFlight = null;
let schemaEnsured = false;

/** @type {typeof fetch | null} */
let fetchImplOverride = null;
let dbCacheEnabled = true;

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

const toRate = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const readAliquota = (aliquotas) => ({
  nacional: toRate(aliquotas?.nacional ?? aliquotas?.Nacional),
  estadual: toRate(aliquotas?.estadual ?? aliquotas?.Estadual),
  importado: toRate(aliquotas?.importado ?? aliquotas?.Importado),
  municipal: toRate(aliquotas?.municipal ?? aliquotas?.Municipal),
  fonte: aliquotas?.fonte ?? aliquotas?.Fonte ?? null,
  versao: aliquotas?.versao ?? aliquotas?.Versao ?? null,
});

export const buildIbptCacheKey = (uf, ncm, ex = DEFAULT_EX) => {
  const ufNorm = String(uf || '').trim().toUpperCase().slice(0, 2);
  const ncmNorm = onlyDigits(ncm, 8);
  const exNorm = String(ex ?? DEFAULT_EX).trim() || DEFAULT_EX;
  return `${ufNorm}:${ncmNorm}:${exNorm}`;
};

/** @internal testes */
export const __setFetchImplForTests = (fn) => {
  fetchImplOverride = typeof fn === 'function' ? fn : null;
};

/** @internal testes */
export const __setIbptDbCacheEnabledForTests = (enabled) => {
  dbCacheEnabled = enabled !== false;
};

/** @internal testes */
export const __resetIbptCacheForTests = () => {
  memoryCache.clear();
  schemaEnsured = false;
  schemaEnsureInFlight = null;
  fetchImplOverride = null;
  dbCacheEnabled = true;
};

export const ensureIbptCacheSchema = async () => {
  if (schemaEnsured) return { ok: true, cached: true };
  if (schemaEnsureInFlight) return schemaEnsureInFlight;

  schemaEnsureInFlight = (async () => {
    try {
      const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
      if (!dbUrl) return { ok: false, skipped: true };
      const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
      const client = new Client({
        connectionString: dbUrl,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      });
      try {
        await client.connect();
        await client.query(IBPT_NCM_CACHE_SCHEMA_SQL);
        schemaEnsured = true;
        return { ok: true };
      } finally {
        await client.end();
      }
    } catch {
      return { ok: false, skipped: true };
    }
  })();

  try {
    return await schemaEnsureInFlight;
  } finally {
    schemaEnsureInFlight = null;
  }
};

const readMemoryCache = (cacheKey) => {
  const hit = memoryCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return hit.data;
};

const writeMemoryCache = (cacheKey, data) => {
  memoryCache.set(cacheKey, { data, expiresAt: Date.now() + MEMORY_TTL_MS });
};

const readDbCache = async (cacheKey) => {
  if (!dbCacheEnabled) return null;
  const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
  if (!dbUrl) return null;

  await ensureIbptCacheSchema();
  const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
  const client = new Client({
    connectionString: dbUrl,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      `select nacional, estadual, importado, municipal, fonte, versao, fetched_at
       from public.ibpt_ncm_cache
       where cache_key = $1
         and fetched_at >= now() - ($2 || ' days')::interval
       limit 1`,
      [cacheKey, String(DB_CACHE_MAX_AGE_DAYS)],
    );
    if (!rows?.length) return null;
    const row = rows[0];
    return {
      nacional: toRate(row.nacional),
      estadual: toRate(row.estadual),
      importado: toRate(row.importado),
      municipal: toRate(row.municipal),
      fonte: row.fonte ? String(row.fonte) : null,
      versao: row.versao ? String(row.versao) : null,
      cached: true,
    };
  } catch {
    return null;
  } finally {
    await client.end();
  }
};

const writeDbCache = async (cacheKey, ncm, uf, ex, data) => {
  if (!dbCacheEnabled) return;
  const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
  if (!dbUrl) return;

  await ensureIbptCacheSchema();
  const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
  const client = new Client({
    connectionString: dbUrl,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query(
      `insert into public.ibpt_ncm_cache (
        cache_key, ncm, uf, ex, nacional, estadual, importado, municipal, fonte, versao, fetched_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      on conflict (cache_key) do update set
        nacional = excluded.nacional,
        estadual = excluded.estadual,
        importado = excluded.importado,
        municipal = excluded.municipal,
        fonte = excluded.fonte,
        versao = excluded.versao,
        fetched_at = now()`,
      [
        cacheKey,
        onlyDigits(ncm, 8),
        String(uf || '').trim().toUpperCase().slice(0, 2),
        String(ex ?? DEFAULT_EX).trim() || DEFAULT_EX,
        data.nacional,
        data.estadual,
        data.importado,
        data.municipal,
        data.fonte,
        data.versao,
      ],
    );
  } catch {
    /* cache opcional — não bloqueia emissão */
  } finally {
    await client.end();
  }
};

const normalizeIbptValor = (value) => {
  const raw = String(value ?? '100.00').trim().replace(',', '.');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return '100.00';
  return parsed.toFixed(2);
};

/**
 * Monta URL oficial IBPT com query params exigidos pela API.
 * NCM enviado em `codigo` — somente 8 dígitos, sem pontuação.
 */
export const buildIbptProdutosUrl = (params) => {
  const codigo = onlyDigits(params?.codigoNcm ?? params?.codigo, 8);
  const query = new URLSearchParams();
  query.set('token', String(params?.token ?? '').trim());
  query.set('cnpj', onlyDigits(params?.cnpj, 14));
  query.set('codigo', codigo);
  query.set('uf', String(params?.uf || '').trim().toUpperCase().slice(0, 2));
  query.set('ex', String(params?.ex ?? DEFAULT_EX).trim() || DEFAULT_EX);
  query.set('descricao', String(params?.descricao || 'Produto').trim() || 'Produto');
  query.set('unidadeMedida', String(params?.unidadeMedida || 'UN').trim() || 'UN');
  query.set('valor', normalizeIbptValor(params?.valor));
  query.set('gtin', String(params?.gtin || DEFAULT_GTIN).trim() || DEFAULT_GTIN);
  return `${IBPT_API_URL}?${query.toString()}`;
};

const normalizeIbptResponse = (body) => ({
  nacional: toRate(body?.Nacional ?? body?.nacional),
  estadual: toRate(body?.Estadual ?? body?.estadual),
  importado: toRate(body?.Importado ?? body?.importado),
  municipal: toRate(body?.Municipal ?? body?.municipal),
  fonte: body?.Fonte != null ? String(body.Fonte) : (body?.fonte != null ? String(body.fonte) : null),
  versao: body?.Versao != null ? String(body.Versao) : (body?.versao != null ? String(body.versao) : null),
  cached: false,
});

const resolveIbptFetchTimeoutMs = () => {
  const configured = Number(env.IBPT_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return IBPT_FETCH_TIMEOUT_MS_DEFAULT;
};

/** Erro de rede/timeout — emissão segue sem transparência IBPT. */
export const isIbptOfflineError = (error) => {
  if (error?.offline === true) return true;
  const message = String(error?.message ?? '').toUpperCase();
  return message.includes('IBPT_FETCH_FAILED')
    || message.includes('IBPT_TIMEOUT')
    || message.includes('FETCH FAILED')
    || message.includes('ECONNREFUSED')
    || message.includes('ENOTFOUND')
    || message.includes('ETIMEDOUT');
};

const withTimeout = async (promise, ms) => {
  const timeoutMs = Number(ms) > 0 ? Number(ms) : IBPT_FETCH_TIMEOUT_MS_DEFAULT;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('IBPT_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const fetchIbptApi = async (params) => {
  const fetchFn = fetchImplOverride || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new Error('fetch indisponível para consulta IBPT');
  }

  const codigoNcm = onlyDigits(params.codigoNcm ?? params.codigo, 8);
  const url = buildIbptProdutosUrl({ ...params, codigoNcm });

  if (!url.startsWith(`${IBPT_API_URL}?`)) {
    throw new Error('IBPT_URL_INVALIDA');
  }

  let response;
  try {
    response = await withTimeout(
      fetchFn(url, {
        method: 'GET',
        headers: IBPT_FETCH_HEADERS,
      }),
      resolveIbptFetchTimeoutMs(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const networkErr = new Error(`IBPT_FETCH_FAILED: ${message}`);
    networkErr.cause = err;
    networkErr.offline = isIbptOfflineError(err) || isIbptOfflineError(networkErr);
    throw networkErr;
  }

  if (!response.ok) {
    const err = new Error(`IBPT_HTTP_${response.status}`);
    err.status = response.status;
    throw err;
  }

  const body = await response.json();
  return normalizeIbptResponse(body);
};

/**
 * Consulta alíquotas IBPT para um produto (NCM).
 * Cache em memória + Postgres por NCM/UF/EX (percentuais independem do valor).
 *
 * @param {{
 *   token: string,
 *   cnpj: string,
 *   codigoNcm: string,
 *   uf: string,
 *   ex?: string,
 *   descricao: string,
 *   unidadeMedida: string,
 *   valor: string | number,
 *   gtin?: string,
 * }} params
 */
export const consultarProdutoIbpt = async (params) => {
  const token = normalizeEnvSecret(params?.token);
  const cnpj = onlyDigits(params?.cnpj, 14);
  const ncm = onlyDigits(params?.codigoNcm, 8);
  const uf = String(params?.uf || '').trim().toUpperCase().slice(0, 2);
  const ex = String(params?.ex ?? DEFAULT_EX).trim() || DEFAULT_EX;

  if (!token) throw new Error('IBPT_TOKEN_AUSENTE');
  if (cnpj.length !== 14) throw new Error('IBPT_CNPJ_INVALIDO');
  if (ncm.length !== 8) throw new Error('IBPT_NCM_INVALIDO');
  if (uf.length !== 2) throw new Error('IBPT_UF_INVALIDA');

  const cacheKey = buildIbptCacheKey(uf, ncm, ex);
  const memHit = readMemoryCache(cacheKey);
  if (memHit) return { ...memHit, cached: true, cacheLayer: 'memory' };

  const dbHit = await readDbCache(cacheKey);
  if (dbHit) {
    writeMemoryCache(cacheKey, dbHit);
    return { ...dbHit, cacheLayer: 'database' };
  }

  const fetched = await fetchIbptApi({ ...params, token, cnpj, codigoNcm: ncm, uf, ex });
  writeMemoryCache(cacheKey, fetched);
  await writeDbCache(cacheKey, ncm, uf, ex, fetched);
  return { ...fetched, cacheLayer: 'api' };
};

/** Origens NFe consideradas importadas para cálculo federal IBPT. */
export const isOrigemMercadoriaImportada = (origemMercadoria) => {
  const o = String(origemMercadoria ?? '0').trim();
  return o === '1' || o === '2' || o === '6' || o === '7';
};

/**
 * Calcula valor aproximado de tributos (vTotTrib) com base nas alíquotas IBPT.
 * Para origem nacional usa % Nacional; importada usa % Importado.
 */
export const calcularValorTributosIbpt = (aliquotas, valorProduto, origemMercadoria = '0') => {
  const valor = Number(valorProduto);
  if (!Number.isFinite(valor) || valor <= 0) return 0;

  const rates = readAliquota(aliquotas);
  const federal = isOrigemMercadoriaImportada(origemMercadoria) ? rates.importado : rates.nacional;
  const totalPct = federal + rates.estadual + rates.municipal;
  return round2(valor * totalPct / 100);
};

export const calcularBreakdownTributosIbpt = (aliquotas, valorProduto, origemMercadoria = '0') => {
  const valor = Number(valorProduto);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { federal: 0, estadual: 0, municipal: 0, total: 0, federalPct: 0, estadualPct: 0, municipalPct: 0 };
  }

  const rates = readAliquota(aliquotas);
  const federalPct = isOrigemMercadoriaImportada(origemMercadoria) ? rates.importado : rates.nacional;

  const federal = round2(valor * federalPct / 100);
  const est = round2(valor * rates.estadual / 100);
  const mun = round2(valor * rates.municipal / 100);
  return {
    federal,
    estadual: est,
    municipal: mun,
    total: round2(federal + est + mun),
    federalPct,
    estadualPct: rates.estadual,
    municipalPct: rates.municipal,
  };
};

export const formatMoedaBr = (valor) => round2(valor).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const isIbptConfigured = () => Boolean(normalizeEnvSecret(env.IBPT_API_TOKEN));

export { resolveIbptFallbackAliquotas, IBPT_FALLBACK_BY_NCM_CHAPTER } from '../lib/ibpt-fallback-aliquotas.js';
