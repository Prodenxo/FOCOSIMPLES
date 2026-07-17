/**
 * Parse de respostas GET /certificado (lista ou filtro) para extrair ID após 409 — US-MEI-FISC-05.
 *
 * Formatos observados em fixtures de teste e integração sandbox (`plugnotas-empresa.test.js`):
 * - Array direto: `[{ id, cpfCnpj, ... }]`
 * - Envelope `{ data: [...] }` ou `{ data: { data: [...] } }` (duplo envelope)
 * - Chaves de coleção no root: `certificados`, `items`, `result` (array), `content`, `records`, `list`
 * - Objeto único em `data` quando a API devolve um registro solto: `{ data: { id, cnpj, ... } }`
 * - Aninhado sob `data`: `data.items`, `data.results`, `data.list`, `data.content`, `data.records`, `data.rows`
 * - `result` como objeto paginado: `{ result: { data: [...] } }` (padrão comum em APIs Java/Spring)
 * - Raiz OData-ish: `value: [...]` ou `rows: [...]`
 *
 * Campos de ID por item (além de `id` / `_id`): `uuid`, `certificadoId`, `idCertificado`;
 * referência aninhada `certificado` como string (ID) ou objeto `{ id, _id }`.
 *
 * Validação mínima de ID: não aceita string vazia, só pontuação, literal "null"/"undefined", nem comprimento > 128.
 */

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const PLUGNOTAS_CERTIFICADO_ID_MAX_LEN = 128;

/** @param {string} raw */
export const isPlausiblePlugnotasCertificadoId = (raw) => {
  const s = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!s || s.length > PLUGNOTAS_CERTIFICADO_ID_MAX_LEN) return false;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return false;
  if (!/[0-9a-z]/i.test(s)) return false;
  return true;
};

/** @param {unknown} value */
export const normalizeCertificadoIdCandidate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const t = String(Math.trunc(value));
    return isPlausiblePlugnotasCertificadoId(t) ? t : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim();
    return isPlausiblePlugnotasCertificadoId(t) ? t : null;
  }
  return null;
};

/** Chaves onde APIs costumam embutir a lista de certificados. */
const COLLECTION_KEYS = Object.freeze([
  'items',
  'results',
  'list',
  'content',
  'records',
  'rows',
  'certificados',
  'value'
]);

/**
 * `data` como objeto único com aparência de linha de certificado (evita confundir com metadados de página).
 * @param {Record<string, unknown>} obj
 */
const isSingletonCertificadoRow = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const hasId = obj.id != null || obj._id != null || obj.uuid != null
    || obj.certificadoId != null || obj.idCertificado != null;
  if (!hasId) return false;
  return !!(
    obj.cpfCnpj || obj.cnpj || obj.cpfCnpjEmpresa || obj.documento || obj.nome
    || typeof obj.certificado === 'string'
    || (obj.certificado && typeof obj.certificado === 'object')
  );
};

/**
 * @param {Record<string, unknown>} envelope
 * @returns {unknown[] | null}
 */
const arrayFromNestedRecord = (envelope) => {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return null;
  for (const key of COLLECTION_KEYS) {
    const v = envelope[key];
    if (Array.isArray(v)) return v;
  }
  return null;
};

export const normalizeCertificadoListItems = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;

  const inner = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : null;

  if (inner && Array.isArray(inner.data)) return inner.data;

  if (inner) {
    const fromInner = arrayFromNestedRecord(inner);
    if (fromInner) return fromInner;
    if (isSingletonCertificadoRow(inner)) return [inner];
  }

  if (Array.isArray(payload.certificados)) return payload.certificados;
  if (Array.isArray(payload.items)) return payload.items;

  if (payload.result && typeof payload.result === 'object' && !Array.isArray(payload.result)) {
    const nested = arrayFromNestedRecord(/** @type {Record<string, unknown>} */ (payload.result));
    if (nested) return nested;
    const rData = /** @type {Record<string, unknown>} */ (payload.result).data;
    if (Array.isArray(rData)) return rData;
  }
  if (Array.isArray(payload.result)) return payload.result;

  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.list)) return payload.list;

  for (const key of ['value', 'rows']) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return [];
};

const MAX_STRING_SCAN_DEPTH = 2;

/** @param {Record<string, unknown>} obj */
const collectStringValuesFromObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > MAX_STRING_SCAN_DEPTH) return [];
  /** @type {string[]} */
  const out = [];
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v) && depth < MAX_STRING_SCAN_DEPTH) {
      out.push(...collectStringValuesFromObject(v, depth + 1));
    } else if (Array.isArray(v) && depth < MAX_STRING_SCAN_DEPTH) {
      for (const el of v) {
        if (typeof el === 'string') out.push(el);
        else if (el && typeof el === 'object' && !Array.isArray(el)) {
          out.push(...collectStringValuesFromObject(el, depth + 1));
        }
      }
    }
  }
  return out;
};

/** @param {Record<string, unknown>} item */
const itemCnpjMatchesListagem = (item, want14) => {
  const doc = normalizeDoc(
    item.cpfCnpj || item.cnpj || item.cpfCnpjEmpresa || item.documento || ''
  );
  if (doc === want14) return true;
  for (const s of collectStringValuesFromObject(item)) {
    if (normalizeDoc(s).includes(want14)) return true;
  }
  return false;
};

/** @param {Record<string, unknown>} item */
const extractCertificadoIdFromListItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const certObj = typeof item.certificado === 'object' && item.certificado !== null
    ? /** @type {Record<string, unknown>} */ (item.certificado)
    : null;
  /** @type {unknown[]} */
  const candidates = [
    item.id,
    item._id,
    item.uuid,
    item.certificadoId,
    item.idCertificado,
    typeof item.certificado === 'string' ? item.certificado : null,
    certObj ? certObj.id : null,
    certObj ? certObj._id : null
  ];
  for (const c of candidates) {
    const n = normalizeCertificadoIdCandidate(c);
    if (n) return n;
  }
  return null;
};

const findCertificadoIdByCnpjNaListagem = (payload, cnpj14) => {
  const want = normalizeDoc(cnpj14);
  if (want.length !== 14) return null;
  const items = normalizeCertificadoListItems(payload);
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (!itemCnpjMatchesListagem(item, want)) continue;
    const id = extractCertificadoIdFromListItem(item);
    if (id) return id;
  }
  return null;
};

/**
 * Último recurso após 409: conta com um único A1 e CNPJ informado, mas sem match por campo/DN.
 * @param {unknown} payload
 * @param {string} cnpj14 — já normalizado (14 dígitos)
 * @returns {string|null}
 */
const findCertificadoIdSeListagemUnica = (payload, cnpj14) => {
  if (normalizeDoc(cnpj14).length !== 14) return null;
  const items = normalizeCertificadoListItems(payload);
  if (items.length !== 1) return null;
  const only = items[0];
  if (!only || typeof only !== 'object') return null;
  return extractCertificadoIdFromListItem(only);
};

/**
 * @param {unknown} payload
 * @param {string} cnpj14
 * @returns {string|null}
 */
export const extrairCertificadoIdDeListagem = (payload, cnpj14) => {
  const byCnpj = findCertificadoIdByCnpjNaListagem(payload, cnpj14);
  if (byCnpj) return byCnpj;
  return findCertificadoIdSeListagemUnica(payload, cnpj14);
};
