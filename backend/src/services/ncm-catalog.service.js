import { Client } from 'pg';
import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { NCMS_SCHEMA_SQL } from './db-bootstrap.service.js';

const NCMS_TABLE = 'ncms';
const BRASILAPI_NCM_URL = 'https://brasilapi.com.br/api/ncm/v1';
const SYNC_STALE_DAYS = 30;
const UPSERT_BATCH_SIZE = 400;

const NCM_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'sem', 'ao', 'aos', 'um', 'uma', 'uns', 'umas', 'que', 'outros', 'outras',
]);

/** @type {Promise<unknown> | null} */
let syncInFlight = null;
/** @type {Promise<{ ok: boolean }> | null} */
let schemaEnsureInFlight = null;
let schemaEnsured = false;

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) return false;
  return defaultValue;
};

/** Cria tabela `ncms` se ainda não existir (idempotente). */
export const ensureNcmTableSchema = async () => {
  if (schemaEnsured) return { ok: true, cached: true };
  if (schemaEnsureInFlight) return schemaEnsureInFlight;

  schemaEnsureInFlight = (async () => {
    const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || '').trim();
    if (!dbUrl) {
      throw badRequest('DATABASE_URL não configurado — não foi possível criar a tabela ncms.');
    }
    const sslEnabled = parseBoolean(env.DB_BOOTSTRAP_SSL, false);
    const client = new Client({
      connectionString: dbUrl,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await client.connect();
      await client.query(NCMS_SCHEMA_SQL);
      schemaEnsured = true;
      return { ok: true };
    } finally {
      await client.end();
    }
  })();

  try {
    return await schemaEnsureInFlight;
  } finally {
    schemaEnsureInFlight = null;
  }
};

/** @internal testes */
export const __resetNcmSchemaCacheForTests = () => {
  schemaEnsured = false;
  schemaEnsureInFlight = null;
};

const defaultGetDb = () => createSupabaseClient({ useServiceRole: true });
/** @type {null | (() => import('@supabase/supabase-js').SupabaseClient)} */
let getDbOverride = null;

/** @internal Apenas testes */
export const __setGetDbForTests = (fn) => {
  getDbOverride = typeof fn === 'function' ? fn : null;
};

export const __resetGetDbForTests = () => {
  getDbOverride = null;
};

const getDb = () => (getDbOverride ? getDbOverride() : defaultGetDb());

const normalizeText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const sanitizeSearchTerm = (value) => String(value || '')
  .trim()
  .replace(/[,%()]/g, ' ')
  .replace(/\s+/g, ' ');

const toSearchLimit = (value, { defaultValue = 12, max = 30 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return defaultValue;
  return Math.min(normalized, max);
};

/** @param {unknown} raw */
export const normalizeNcmCode = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return digits;
};

/** @param {unknown} raw */
export const formatNcmCodeDisplay = (raw) => {
  const code = normalizeNcmCode(raw);
  if (!code) return '';
  return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6, 8)}`;
};

/** Remove tags HTML e normaliza texto vindo da BrasilAPI/Receita. */
export const stripNcmHtml = (raw) => String(raw ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

/** @param {unknown} raw */
export const cleanNcmDescription = (raw) => {
  const text = stripNcmHtml(raw);
  if (!text) return '';
  return text.replace(/^[-–—\s]+/, '').trim() || text;
};

/** @param {string} code @param {string} description */
export const formatNcmLabel = (code, description) => {
  const display = formatNcmCodeDisplay(code);
  const desc = cleanNcmDescription(description);
  if (!display) return desc;
  return desc ? `${display} - ${desc}` : display;
};

/** @param {unknown} text */
export const extractNcmSearchTokens = (text, { max = 4 } = {}) => {
  const raw = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const words = raw.split(/[^a-z0-9]+/).filter((w) => (
    w.length >= 3 && !NCM_STOPWORDS.has(w)
  ));
  const unique = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
  }
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, max);
};

/** @param {Array<{ codigo?: string, descricao?: string }>} rows */
export const mapBrasilApiNcmRows = (rows) => {
  const mapped = [];
  const seen = new Set();
  for (const row of rows || []) {
    const code = normalizeNcmCode(row?.codigo);
    if (!code || seen.has(code)) continue;
    const description = cleanNcmDescription(row?.descricao);
    if (!description) continue;
    seen.add(code);
    mapped.push({ code, description });
  }
  return mapped;
};

const fetchBrasilApiNcmCatalog = async () => {
  const response = await fetch(BRASILAPI_NCM_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw badRequest(`Falha ao consultar BrasilAPI NCM (${response.status}).`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw badRequest('Resposta inválida da BrasilAPI NCM.');
  }
  return mapBrasilApiNcmRows(payload);
};

const upsertNcmBatch = async (dbClient, batch) => {
  if (!batch.length) return;
  const now = new Date().toISOString();
  const rows = batch.map((row) => ({
    code: row.code,
    description: row.description,
    updated_at: now,
  }));
  const { error } = await dbClient
    .from(NCMS_TABLE)
    .upsert(rows, { onConflict: 'code' });
  if (error) throw badRequest(error.message);
};

/** @returns {Promise<{ total: number, syncedAt: string }>} */
export const syncNcmCatalogFromBrasilApi = async () => {
  const rows = await fetchBrasilApiNcmCatalog();
  if (rows.length === 0) {
    throw badRequest('BrasilAPI NCM retornou catálogo vazio.');
  }

  const dbClient = getDb();
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    await upsertNcmBatch(dbClient, rows.slice(i, i + UPSERT_BATCH_SIZE));
  }

  return { total: rows.length, syncedAt: new Date().toISOString() };
};

const getNcmCatalogMeta = async () => {
  const dbClient = getDb();
  const { count, error: countError } = await dbClient
    .from(NCMS_TABLE)
    .select('code', { count: 'exact', head: true });
  if (countError) throw badRequest(countError.message);

  const { data, error } = await dbClient
    .from(NCMS_TABLE)
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw badRequest(error.message);

  return {
    count: count ?? 0,
    lastUpdatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
};

const isCatalogStale = (lastUpdatedAt) => {
  if (!lastUpdatedAt) return true;
  const updatedMs = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(updatedMs)) return true;
  const staleMs = SYNC_STALE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - updatedMs >= staleMs;
};

/** Sincroniza se tabela vazia ou desatualizada (>30 dias). */
export const ensureNcmCatalogSynced = async ({ force = false } = {}) => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    await ensureNcmTableSchema();
    const meta = await getNcmCatalogMeta();
    if (!force && meta.count > 0 && !isCatalogStale(meta.lastUpdatedAt)) {
      return { skipped: true, ...meta };
    }
    const result = await syncNcmCatalogFromBrasilApi();
    return { skipped: false, ...result };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

const mapNcmRow = (row) => ({
  code: normalizeNcmCode(row?.code),
  description: cleanNcmDescription(row?.description),
  label: formatNcmLabel(row?.code, row?.description),
});

export const rankNcmRows = (rows, tokens) => {
  const scored = (rows || []).map((row) => {
    const code = normalizeNcmCode(row?.code);
    const desc = normalizeText(row?.description)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const codeDisplay = formatNcmCodeDisplay(code).toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (desc.includes(token)) score += token.length >= 5 ? 4 : 2;
      if (code.includes(token) || codeDisplay.includes(token)) score += 3;
    }
    return { row, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.row.code || '').localeCompare(String(b.row.code || ''), 'pt-BR');
  });

  return scored.filter((s) => s.score > 0).map((s) => mapNcmRow(s.row));
};

/** Busca NCM no catálogo local (prioritário). */
export const buscarNcmsCatalogo = async ({ q = '', limit = 12 } = {}) => {
  await ensureNcmTableSchema();
  const meta = await getNcmCatalogMeta();
  if (meta.count === 0) {
    void ensureNcmCatalogSynced({ force: true }).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[ncm-sync] sync em background falhou:', error?.message || error);
    });
    throw badRequest(
      'Catálogo NCM ainda está carregando. Aguarde cerca de 30 segundos e busque de novo.',
    );
  }
  const safeLimit = toSearchLimit(limit);
  const query = sanitizeSearchTerm(q);
  const dbClient = getDb();

  const digits = query.replace(/\D/g, '');
  if (digits.length >= 4) {
    const { data, error } = await dbClient
      .from(NCMS_TABLE)
      .select('code, description')
      .like('code', `${digits.slice(0, 8)}%`)
      .order('code', { ascending: true })
      .limit(safeLimit);
    if (error) throw badRequest(error.message);
    return (data || []).map(mapNcmRow);
  }

  const tokens = extractNcmSearchTokens(query);
  if (tokens.length === 0) {
    const { data, error } = await dbClient
      .from(NCMS_TABLE)
      .select('code, description')
      .order('code', { ascending: true })
      .limit(safeLimit);
    if (error) throw badRequest(error.message);
    return (data || []).map(mapNcmRow);
  }

  const likeFilters = tokens.flatMap((token) => {
    const safe = sanitizeSearchTerm(token);
    if (!safe) return [];
    const like = `%${safe}%`;
    return [`description.ilike.${like}`, `code.ilike.${like}`];
  });

  const { data, error } = await dbClient
    .from(NCMS_TABLE)
    .select('code, description')
    .or(likeFilters.join(','))
    .limit(Math.max(safeLimit * 6, 40));
  if (error) throw badRequest(error.message);

  const ranked = rankNcmRows(data, tokens);
  if (ranked.length > 0) return ranked.slice(0, safeLimit);

  const fallbackToken = tokens[0];
  const { data: fallbackData, error: fallbackError } = await dbClient
    .from(NCMS_TABLE)
    .select('code, description')
    .ilike('description', `%${fallbackToken}%`)
    .order('code', { ascending: true })
    .limit(safeLimit);
  if (fallbackError) throw badRequest(fallbackError.message);
  return (fallbackData || []).map(mapNcmRow);
};

/** Sugestões a partir do nome/descrição do produto (fuzzy). */
export const sugerirNcmsPorTexto = async ({ texto = '', limit = 12 } = {}) => {
  const trimmed = sanitizeSearchTerm(texto).slice(0, 80);
  if (!trimmed) return [];
  return buscarNcmsCatalogo({ q: trimmed, limit });
};
