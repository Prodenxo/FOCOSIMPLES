/**
 * Monta mensagem legível a partir de respostas de erro JSON do Plugnotas
 * (message + errors/details), reutilizável em NFSe, empresa, etc.
 *
 * Formatos de detalhe cobertos além de errors/details na raiz:
 * - error.data (objeto completo, ex.: mapa campo -> mensagens ou aninhamento)
 * - error.violations / error.issues
 * - data, violations, issues, validationErrors, constraintViolations, problems na raiz
 */

const RESERVED_ERROR_KEYS = new Set([
  'field',
  'campo',
  'reason',
  'error',
  'motivo',
  'message',
  'mensagem',
  'description',
  'descricao',
  'details',
  'detalhes',
  'errors',
  'erros',
  'validationErrors',
  'issues',
  'violations',
  'constraintViolations',
  'problems'
]);

const withFieldContext = (field, text) => {
  const safeField = String(field || '').trim();
  const safeText = String(text || '').trim();
  if (!safeText) return '';
  return safeField ? `${safeField}: ${safeText}` : safeText;
};

const collectErrorMessages = (value, fieldContext = '') => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const text = withFieldContext(fieldContext, value);
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorMessages(item, fieldContext));
  }
  if (typeof value === 'object') {
    const entries = [];
    const field = String(value.field || value.campo || fieldContext || '').trim();
    const reason = String(
      value.reason || value.error || value.motivo || value.message || value.mensagem || ''
    ).trim();
    if (reason) {
      const text = withFieldContext(field, reason);
      if (text) entries.push(text);
    }
    entries.push(
      ...collectErrorMessages(value.message),
      ...collectErrorMessages(value.mensagem),
      ...collectErrorMessages(value.description),
      ...collectErrorMessages(value.descricao),
      ...collectErrorMessages(value.details),
      ...collectErrorMessages(value.detalhes),
      ...collectErrorMessages(value.errors),
      ...collectErrorMessages(value.erros),
      ...collectErrorMessages(value.validationErrors),
      ...collectErrorMessages(value.issues),
      ...collectErrorMessages(value.violations),
      ...collectErrorMessages(value.constraintViolations),
      ...collectErrorMessages(value.problems)
    );

    Object.entries(value).forEach(([key, item]) => {
      if (RESERVED_ERROR_KEYS.has(key)) return;
      const nextField = fieldContext ? `${fieldContext}.${key}` : key;
      entries.push(...collectErrorMessages(item, nextField));
    });

    return entries;
  }
  return [];
};

/**
 * @param {unknown} payload
 * @param {string} [statusText]
 * @returns {string}
 */
export const buildErrorMessageFromBody = (payload, statusText = '') => {
  if (payload === null || payload === undefined) return statusText;
  if (typeof payload === 'string') return payload || statusText;
  const baseMessage = String(
    payload?.error?.message
    || payload?.message
    || payload?.mensagem
    || payload?.descricao
    || (typeof payload?.error === 'string' ? payload.error : '')
    || statusText
    || ''
  ).trim();
  const detailMessages = [
    ...collectErrorMessages(payload?.error?.details),
    ...collectErrorMessages(payload?.error?.errors),
    ...collectErrorMessages(payload?.error?.validationErrors),
    ...collectErrorMessages(payload?.error?.data),
    ...collectErrorMessages(payload?.error?.violations),
    ...collectErrorMessages(payload?.error?.issues),
    ...collectErrorMessages(payload?.details),
    ...collectErrorMessages(payload?.errors),
    ...collectErrorMessages(payload?.erros),
    ...collectErrorMessages(payload?.validationErrors),
    ...collectErrorMessages(payload?.data),
    ...collectErrorMessages(payload?.violations),
    ...collectErrorMessages(payload?.issues),
    ...collectErrorMessages(payload?.constraintViolations),
    ...collectErrorMessages(payload?.problems)
  ].filter(Boolean);
  const details = [...new Set(detailMessages)].join(' | ');
  if (baseMessage && details && !baseMessage.includes(details)) {
    return `${baseMessage}: ${details}`;
  }
  return baseMessage || details || statusText;
};

/**
 * Mensagem legível após o corpo já ter sido lido com `response.json()` ou `response.text()`.
 * Usa as mesmas regras que {@link parsePlugnotasErrorResponse} (NFSe precisa ler o corpo antes para log 400).
 *
 * @param {unknown} parsedBody
 * @param {string} [statusText]
 * @returns {string}
 */
export const messageFromPlugnotasParsedBody = (parsedBody, statusText = '') => (
  buildErrorMessageFromBody(parsedBody, statusText)
);

/**
 * @param {Response} response
 * @returns {Promise<string>}
 */
export const parsePlugnotasErrorResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return messageFromPlugnotasParsedBody(payload, response.statusText);
  }
  const text = await response.text();
  return messageFromPlugnotasParsedBody(text, response.statusText);
};
