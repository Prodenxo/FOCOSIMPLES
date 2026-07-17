import { env } from '../config/env.js';

const summarizeBody = (body) => {
  if (!body) return null;
  if (typeof body !== 'object') return { type: typeof body };
  const keys = Object.keys(body);
  return { keys, size: keys.length };
};

export const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';
  const errors = err.errors || null;

  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[error]', {
      status,
      message,
      stack: err.stack,
      method: req?.method,
      url: req?.originalUrl,
      params: req?.params,
      query: req?.query,
      body: summarizeBody(req?.body)
    });
  } else if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', {
      status,
      message: err?.message || '(sem mensagem)',
      stack: err?.stack,
      method: req?.method,
      url: req?.originalUrl,
      action: req?.body?.action,
    });
  }

  res.status(status).json({
    success: false,
    data: null,
    message,
    errors
  });
};
