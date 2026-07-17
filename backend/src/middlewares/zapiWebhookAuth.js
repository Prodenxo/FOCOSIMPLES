import { env } from '../config/env.js';
import { unauthorized, serviceUnavailable } from '../utils/errors.js';

/**
 * Valida token do webhook Z-API (query `token` ou header `Client-Token` / `x-zapi-webhook-token`).
 */
export const requireZapiInboundSecret = (req, _res, next) => {
  const secret = (env.ZAPI_WEBHOOK_TOKEN || '').trim();
  if (!secret) {
    return next(
      serviceUnavailable(
        'Webhook Z-API desativado: defina ZAPI_WEBHOOK_TOKEN no ambiente.',
      ),
    );
  }

  const q = req.query?.token ?? req.query?.secret;
  const fromQuery = q != null ? String(q).trim() : '';
  const clientToken = req.headers['client-token'];
  const xToken = req.headers['x-zapi-webhook-token'];
  const fromHeader = [clientToken, xToken]
    .map((v) => (v != null ? String(v).trim() : ''))
    .find(Boolean) || '';

  const candidate = fromQuery || fromHeader;
  if (!candidate || candidate !== secret) {
    return next(unauthorized('Token do webhook Z-API inválido ou ausente'));
  }

  return next();
};
