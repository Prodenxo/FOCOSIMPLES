/**
 * Evita emissões duplicadas via WhatsApp/OpenClaw quando o agente chama emit_* várias vezes.
 * - dedup in-flight (mesma promise)
 * - cache recente (TTL) após sucesso
 */

import {
  extractNfeItemQuantidade,
  extractNfeItemValorUnitario,
} from './plugnotas/plugnotas-nfe-payload.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const DEFAULT_TTL_MS = Number(process.env.OPENCLAW_NF_EMIT_DEDUP_TTL_MS || 120_000);

/** @type {Map<string, Promise<{ nota: object, deduplicated: boolean }>>} */
const pendingEmits = new Map();

/** @type {Map<string, { nota: object, expiresAt: number }>} */
const recentEmits = new Map();

const normalizeText = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\u0300/g, '');

const extractNfeLineTotal = (item) => {
  if (!item || typeof item !== 'object') return 0;
  const direct = round2(item.valor);
  if (direct > 0) return direct;
  const qtd = extractNfeItemQuantidade(item);
  const vu = extractNfeItemValorUnitario(item);
  if (qtd != null && vu != null && qtd > 0 && vu > 0) return round2(qtd * vu);
  return 0;
};

/**
 * @param {string} userId
 * @param {object} input
 */
export const buildOpenclawNfeEmitFingerprint = (userId, input) => {
  const dest = onlyDigits(input?.destinatario?.cpfCnpj, 14);
  const meta = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const itens = Array.isArray(input?.itens) && input.itens.length ? input.itens : [{}];
  const catalogIds = Array.isArray(meta.catalogoProdutoIds) && meta.catalogoProdutoIds.length
    ? meta.catalogoProdutoIds.map((id) => String(id || '').trim())
    : [];
  const itemsKey = itens
    .map((item, index) => {
      const produtoKey = String(catalogIds[index] || meta.catalogoProdutoId || '').trim()
        || normalizeText(item?.codigo)
        || normalizeText(item?.descricao);
      const valor = extractNfeLineTotal(item);
      const qtd = extractNfeItemQuantidade(item) ?? 1;
      return `${produtoKey}:${valor}:${qtd}`;
    })
    .join(';');
  return [userId, 'NFE', dest, itemsKey].join('|');
};

/**
 * @param {string} userId
 * @param {object} input
 */
export const buildOpenclawNfseEmitFingerprint = (userId, input) => {
  const tomador = onlyDigits(input?.tomadorCpfCnpj, 14);
  const meta = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const servico = input?.servico && typeof input.servico === 'object' ? input.servico : {};
  const servicoKey = String(meta.catalogoProdutoId || '').trim()
    || normalizeText(servico.codigo)
    || normalizeText(servico.discriminacao);
  const valor = round2(servico.valorServico ?? servico.valor?.servico ?? 0);
  return [userId, 'NFSE', tomador, servicoKey, valor].join('|');
};

/**
 * @param {string} fingerprint
 * @param {() => Promise<object>} emitFn — deve resolver com o registro da nota criada
 */
export const runOpenclawEmitWithDedup = async (fingerprint, emitFn) => {
  const key = String(fingerprint || '').trim();
  if (!key) {
    const nota = await emitFn();
    return { nota, deduplicated: false };
  }

  const now = Date.now();
  const cached = recentEmits.get(key);
  if (cached && cached.expiresAt > now) {
    return { nota: cached.nota, deduplicated: true, dedupReason: 'recent_cache' };
  }
  if (cached) recentEmits.delete(key);

  const inflight = pendingEmits.get(key);
  if (inflight) {
    const result = await inflight;
    return { ...result, deduplicated: true, dedupReason: 'in_flight' };
  }

  const run = (async () => {
    const nota = await emitFn();
    return { nota, deduplicated: false };
  })();

  pendingEmits.set(key, run);

  try {
    const result = await run;
    if (result?.nota?.id) {
      recentEmits.set(key, {
        nota: result.nota,
        expiresAt: Date.now() + DEFAULT_TTL_MS,
      });
    }
    return result;
  } finally {
    pendingEmits.delete(key);
  }
};

/** @param {string} [key] */
export const __resetOpenclawEmitDedupForTests = (key) => {
  if (key) {
    pendingEmits.delete(key);
    recentEmits.delete(key);
    return;
  }
  pendingEmits.clear();
  recentEmits.clear();
};
