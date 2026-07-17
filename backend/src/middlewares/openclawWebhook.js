import { env, normalizeEnvSecret } from '../config/env.js';
import { unauthorized, serviceUnavailable } from '../utils/errors.js';

/**
 * Autenticação servidor-a-servidor (OpenClaw / n8n → backend). Estilo Bearer.
 */
export const requireOpenclawSecret = (req, _res, next) => {
  const secret = env.OPENCLAW_WEBHOOK_SECRET;
  if (!secret) {
    return next(
      serviceUnavailable(
        'Bot OpenClaw desativado: defina OPENCLAW_WEBHOOK_SECRET no ambiente.',
      ),
    );
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return next(unauthorized('Bearer obrigatório'));
  }

  const token = normalizeEnvSecret(authHeader.replace(/^Bearer\s+/i, '').trim());
  if (token !== secret) {
    return next(unauthorized('Segredo inválido'));
  }

  return next();
};
