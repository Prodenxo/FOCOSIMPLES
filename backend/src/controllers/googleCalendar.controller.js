import { proxyRequest } from '../services/googleCalendar.service.js';
import { badRequest } from '../utils/errors.js';

const ALLOWED_ROUTES = new Map([
  ['check-auth', new Set(['GET'])],
  ['auth', new Set(['GET'])],
  ['callback', new Set(['POST'])],
  ['events', new Set(['GET'])],
  ['create-event', new Set(['POST'])]
]);

export const isAllowedProxyRoute = (path, method) => {
  const cleanPath = String(path || '').trim();
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const allowedMethods = ALLOWED_ROUTES.get(cleanPath);

  return Boolean(allowedMethods && allowedMethods.has(normalizedMethod));
};

const ensureAllowedProxyRoute = (path, method) => {
  if (!isAllowedProxyRoute(path, method)) {
    const cleanPath = String(path || '').trim();
    if (!ALLOWED_ROUTES.has(cleanPath)) {
      throw badRequest('Rota de integração inválida');
    }
    throw badRequest('Método não permitido para a rota de integração');
  }
};

export const proxyGoogleCalendar = async (req, res, next) => {
  try {
    const proxyPath = req.params.path || '';
    const proxyMethod = req.method;
    ensureAllowedProxyRoute(proxyPath, proxyMethod);

    const result = await proxyRequest({
      path: proxyPath,
      method: proxyMethod,
      headers: { authorization: req.headers.authorization || '' },
      query: req.query,
      body: req.body
    });

    const contentType = result.contentType || '';
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const isJson = contentType.includes('application/json');
    const isSuccessStatus = result.status >= 200 && result.status < 400;

    if (isJson && isSuccessStatus && result.body) {
      try {
        const parsed = JSON.parse(result.body);
        if (parsed && typeof parsed === 'object' && 'data' in parsed) {
          res.status(result.status).json(parsed);
          return;
        }
        res.status(result.status).json({ data: parsed });
        return;
      } catch (error) {
        // Se falhar o parse, seguir com o body original
      }
    }

    res.status(result.status).send(result.body);
  } catch (error) {
    next(error);
  }
};
