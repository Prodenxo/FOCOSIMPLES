/**
 * Normalização de erros 502/503/504 e corpo HTML típico de proxy/gateway no upstream Plugnotas.
 * PRD FR-MEI-CERT-GW-01 / arquitetura gateway upstream 2026-04-08.
 *
 * Heurística:
 * - HTTP 502, 503 ou 504 → sempre substituir `message` ao cliente por texto PT canónico + código estável.
 * - Conteúdo `text/html` ou string que começa por `<` com marcadores de página de gateway (Bad Gateway,
 *   Gateway Timeout, Service Unavailable) **e** status já é 502–504 (coberto pelo primeiro critério).
 * - Não normalizar status 400 com JSON de validação (CR-GW-02).
 */

/** Mensagem única ao cliente (paridade com PRD §6.1 / UX spec §4.2). */
export const PLUGNOTAS_GATEWAY_UPSTREAM_PUBLIC_MESSAGE_PT =
  'O emissor fiscal não está a responder neste momento (erro temporário no servidor). '
  + 'Tente de novo dentro de alguns minutos. Se o problema continuar, confirme no servidor a URL e a chave '
  + 'de API do emissor, ou contacte o suporte do emissor fiscal.';

const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * @param {string} text
 * @param {string} [contentType]
 * @returns {boolean}
 */
export function isLikelyGatewayHtmlBody(text, contentType = '') {
  if (!text || typeof text !== 'string') return false;
  const ct = String(contentType).toLowerCase();
  if (ct.includes('text/html')) return true;
  const t = text.trim();
  if (!t.startsWith('<')) return false;
  const lower = t.toLowerCase();
  return (
    lower.includes('bad gateway')
    || lower.includes('gateway timeout')
    || lower.includes('service unavailable')
    || lower.includes('502')
    || lower.includes('503')
    || lower.includes('504')
  );
}

/**
 * @param {number} status
 * @returns {boolean}
 */
export function shouldNormalizePlugnotasGatewayError(status) {
  return GATEWAY_STATUSES.has(Number(status) || 0);
}

/**
 * @param {number} status
 * @returns {string}
 */
export function getPlugnotasGatewayUpstreamCode(status) {
  const s = Number(status) || 502;
  if (s === 503) return 'plugnotas_gateway_503';
  if (s === 504) return 'plugnotas_gateway_504';
  return 'plugnotas_gateway_502';
}

/**
 * @param {number} status
 * @returns {{ publicMessage: string, plugnotasCode: string } | null}
 */
export function resolvePlugnotasGatewayUpstreamForClient(status) {
  if (!shouldNormalizePlugnotasGatewayError(status)) return null;
  return {
    publicMessage: PLUGNOTAS_GATEWAY_UPSTREAM_PUBLIC_MESSAGE_PT,
    plugnotasCode: getPlugnotasGatewayUpstreamCode(status)
  };
}

const LOG_BODY_MAX_LEN = 800;

/**
 * Evita `console.error` com HTML completo ou mensagens enormes (NFR-GW-02 / feedback QA observação 1),
 * mesmo com `PLUGNOTAS_DEBUG` em produção.
 *
 * @param {unknown} raw — típico `messageFromPlugnotasPayload` (string) ou ocasionalmente objeto
 * @param {string} [contentType] — `response.headers.get('content-type')`
 * @returns {unknown}
 */
export function summarizePlugnotasErrorLogBody(raw, contentType = '') {
  if (raw == null) return raw;
  if (typeof raw === 'string') {
    if (isLikelyGatewayHtmlBody(raw, contentType)) {
      return `[html_error_body omitted ${raw.length} chars]`;
    }
    if (raw.length > LOG_BODY_MAX_LEN) {
      return `${raw.slice(0, LOG_BODY_MAX_LEN)}…[truncated ${raw.length - LOG_BODY_MAX_LEN} chars]`;
    }
    return raw;
  }
  if (typeof raw === 'object') {
    try {
      const s = JSON.stringify(raw);
      if (s.length > LOG_BODY_MAX_LEN) {
        return `${s.slice(0, LOG_BODY_MAX_LEN)}…[truncated object]`;
      }
      return raw;
    } catch {
      return '[unserializable_body]';
    }
  }
  return raw;
}
