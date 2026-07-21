const APP_ORIGINS = new Set(['focomei', 'financeiro', 'focosimples']);

export const normalizeAppOrigin = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return APP_ORIGINS.has(text) ? text : null;
};

/** Metadados Auth para marcar origem do cadastro (sem migration SQL). */
export const buildSignupOriginMetadata = (appOrigin) => {
  const normalized = normalizeAppOrigin(appOrigin);
  if (!normalized) return {};
  return {
    app_origin: normalized,
    product_line: normalized === 'focosimples' ? 'financeiro' : normalized,
  };
};

export const resolveAppOriginFromRequest = (body = {}, headers = {}) => {
  const fromBody = normalizeAppOrigin(body.appOrigin ?? body.app_origin);
  if (fromBody) return fromBody;

  const originHeader = String(headers.origin || headers.Origin || '').toLowerCase();
  if (originHeader.includes('focosimples')) return 'focosimples';
  if (originHeader.includes('focomei')) return 'focomei';
  if (originHeader.includes('meiinfinito') || originHeader.includes('meufinanceiro')) {
    return 'financeiro';
  }

  const deployDefault = normalizeAppOrigin(process.env.APP_PRODUCT);
  return deployDefault || 'focosimples';
};
