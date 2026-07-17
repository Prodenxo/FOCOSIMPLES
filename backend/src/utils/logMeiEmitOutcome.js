import { HttpError } from './errors.js';
import { getPlugnotasCodeFromApiErrors } from './plugnotas-api-error-code.js';
import { maskPlugnotasPathOrUrlForLog } from '../services/plugnotas/plugnotas-request-log-path.js';

/** Rota estável para agregação (labels §9.3 — sem `user_id`). */
export const MEI_EMIT_ROUTE_EMITIR_NOTA = 'emitir_nota';

/** Fases de `emitirNota` para diagnóstico sem PII (distingue p.ex. persistência vs HTTP Plugnotas). */
export const MEI_EMIT_FAILURE_PHASES = new Set([
  'resolve',
  'adapter',
  'build',
  'validate',
  'plugnotas_emit',
  'insert_record'
]);

/**
 * NFR-POST-01 / NFR-POST-02 — telemetria agregada do caminho `emitirNota` (sem PII em `info`).
 *
 * **Campos permitidos no objecto serializado (JSON uma linha):**
 * - `event`: sempre `mei_emit_outcome`
 * - `route`: rota estável (p.ex. {@link MEI_EMIT_ROUTE_EMITIR_NOTA})
 * - `document_type`: `NFSE` | `NFE` | `NFCE` | `CTE` | `INVALID` (tipo de entrada inválido antes de resolver)
 * - `duration_ms`: latência medida no servidor (número inteiro ≥ 0)
 * - `outcome`: `success` | `validation_error` | `plugnotas_error`
 *
 * **Opcionais (erros / sucesso enriquecido):**
 * - `failure_phase`: fase em que falhou (`resolve` \| `adapter` \| `build` \| `validate` \| `plugnotas_emit` \| `insert_record`) — só em `validation_error` / `plugnotas_error`
 * - `http_status`: quando `error` é {@link HttpError}, o `status` HTTP (nunca dados fiscais)
 * - `plugnotas_path_masked`: path Plugnotas mascarado (sem CNPJ/CPF literais), para agrupar por endpoint
 * - `plugnotas_code`: código estável de `errors.plugnotasCode` quando existir (só caracteres `[A-Za-z0-9_.]`)
 * - `plugnotas_status`: estado textual curto devolvido pelo emissor (ex.: situação da nota), truncado e sanitizado
 *
 * **Níveis:** `success` e `validation_error` → `console.info`; `plugnotas_error` → `console.warn`.
 * Não incluir payload fiscal, CPF/CNPJ completos nem `user_id` em labels públicos.
 *
 * @param {object} p
 * @param {string} p.document_type
 * @param {number} p.duration_ms
 * @param {'success'|'validation_error'|'plugnotas_error'} p.outcome
 * @param {string} [p.route]
 * @param {number|null|undefined} [p.http_status]
 * @param {string|null|undefined} [p.plugnotas_path_masked]
 * @param {string|null|undefined} [p.plugnotas_status]
 * @param {string|null|undefined} [p.failure_phase]
 * @param {string|null|undefined} [p.plugnotas_code]
 */
export function logMeiEmitOutcome(p) {
  const base = {
    event: 'mei_emit_outcome',
    route: p.route || MEI_EMIT_ROUTE_EMITIR_NOTA,
    document_type: p.document_type,
    duration_ms: Math.max(0, Math.trunc(Number(p.duration_ms) || 0)),
    outcome: p.outcome
  };
  if (p.failure_phase && MEI_EMIT_FAILURE_PHASES.has(String(p.failure_phase))) {
    base.failure_phase = String(p.failure_phase);
  }
  if (p.http_status != null && Number.isFinite(Number(p.http_status))) {
    base.http_status = Number(p.http_status);
  }
  if (p.plugnotas_path_masked) {
    base.plugnotas_path_masked = String(p.plugnotas_path_masked).slice(0, 256);
  }
  if (p.plugnotas_code) {
    base.plugnotas_code = String(p.plugnotas_code).slice(0, 80);
  }
  if (p.plugnotas_status) {
    base.plugnotas_status = String(p.plugnotas_status).slice(0, 96);
  }
  const line = JSON.stringify(base);
  if (p.outcome === 'plugnotas_error') {
    console.warn('[mei-emit]', line);
  } else {
    console.info('[mei-emit]', line);
  }
}

/**
 * Rótulo de `document_type` para log quando `resolveInputDocumentType` ainda não correu ou falhou.
 * @param {object} [input]
 * @returns {string}
 */
export function fallbackDocumentTypeLabelFromInput(input) {
  const raw = String(input?.documentType ?? input?.document_type ?? 'NFSE').trim().toUpperCase();
  if (['NFSE', 'NFE', 'NFCE', 'CTE'].includes(raw)) return raw;
  return 'INVALID';
}

/**
 * Extrai metadados seguros de erro HTTP / Plugnotas para o registo NFR-POST-01.
 * @param {unknown} error
 * @returns {{ http_status: number|null, plugnotas_path_masked: string|null, plugnotas_code: string|null }}
 */
export function extractMeiEmitHttpMeta(error) {
  if (!(error instanceof HttpError)) {
    return { http_status: null, plugnotas_path_masked: null, plugnotas_code: null };
  }
  const http_status = typeof error.status === 'number' ? error.status : null;
  const path = error.errors?.plugnotasRequest?.path;
  const plugnotas_path_masked =
    typeof path === 'string' && path.length > 0 ? maskPlugnotasPathOrUrlForLog(path) : null;
  const rawCode = getPlugnotasCodeFromApiErrors(error.errors);
  const plugnotas_code = sanitizePlugnotasCodeForEmitLog(rawCode);
  return { http_status, plugnotas_path_masked, plugnotas_code };
}

/**
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
export function sanitizePlugnotasCodeForEmitLog(code) {
  if (code == null || typeof code !== 'string') return null;
  const s = code.trim().slice(0, 80);
  if (!s) return null;
  if (!/^[\w.]+$/i.test(s)) return null;
  return s;
}

/** Letras (incl. acentos), números, espaço e símbolos seguros — sem `<`/`{` (evita JSON/HTML em status). */
const SAFE_STATUS_RE = /^[\p{L}\p{N}_\-./\s]+$/u;

/**
 * Sanitiza token de situação/status Plugnotas para log (evita vazar mensagens longas ou JSON).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function sanitizePlugnotasStatusForLog(raw) {
  const t = String(raw ?? '').trim().slice(0, 96);
  if (!t) return null;
  if (!SAFE_STATUS_RE.test(t)) return null;
  return t;
}
