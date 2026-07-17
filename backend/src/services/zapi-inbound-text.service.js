/**
 * Extrai texto de payloads Z-API "ReceivedCallback" (formatos variam por versão / tipo).
 * @param {Record<string, unknown>} body
 */
export const extractZapiInboundText = (body) => {
  if (!body || typeof body !== 'object') return '';

  const candidates = [];

  const textObj = body.text;
  if (textObj && typeof textObj === 'object') {
    const msg = /** @type {Record<string, unknown>} */ (textObj).message;
    if (typeof msg === 'string') candidates.push(msg);
  }
  if (typeof body.text === 'string') candidates.push(body.text);

  for (const key of ['message', 'content', 'caption', 'body']) {
    const v = body[key];
    if (typeof v === 'string') candidates.push(v);
  }

  const buttonsResponse = body.buttonsResponseMessage;
  if (buttonsResponse && typeof buttonsResponse === 'object') {
    const m = /** @type {Record<string, unknown>} */ (buttonsResponse).message;
    if (typeof m === 'string') candidates.push(m);
  }

  for (const raw of candidates) {
    const t = String(raw || '').trim();
    if (t) return t;
  }
  return '';
};

/**
 * Normaliza comandos (BOM, espaços, barra Unicode).
 * @param {string} text
 */
export const normalizeInboundCommandText = (text) => {
  let t = String(text || '').trim();
  if (!t) return '';
  t = t.replace(/^\uFEFF/, '');
  if (t.startsWith('\uFF0F')) {
    t = `/${t.slice(1).trim()}`;
  }
  return t.trim();
};
