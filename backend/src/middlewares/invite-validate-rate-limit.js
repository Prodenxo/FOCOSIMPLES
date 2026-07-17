import { env } from '../config/env.js';

const buckets = new Map();
const WINDOW_MS = 60_000;

/**
 * Rate limit in-memory por IP para rotas públicas de validação de convite (NFR-02 US-INV-02).
 * Em produção com múltiplas instâncias, preferir Redis ou gateway — documentado como limitação.
 */
export const inviteValidateRateLimit = (req, res, next) => {
  const max = Math.max(1, Number(env.INVITE_VALIDATE_MAX_PER_MINUTE) || 60);
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > max) {
    return res.status(429).json({
      success: false,
      data: null,
      message: 'Muitas tentativas. Aguarde um minuto.',
      errors: null
    });
  }
  return next();
};
