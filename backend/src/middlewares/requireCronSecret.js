import { unauthorized } from '../utils/errors.js';

export const requireCronSecret = (req, _res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return next(unauthorized('CRON_SECRET não configurado no servidor'));
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== cronSecret) {
    return next(unauthorized('Acesso não autorizado ao endpoint cron'));
  }
  return next();
};
