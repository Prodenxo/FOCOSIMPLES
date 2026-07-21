import { createSupabaseClient } from '../config/supabase.js';
import { normalizeEnvSecret, env } from '../config/env.js';
import { unauthorized, badRequest, serviceUnavailable } from '../utils/errors.js';
import {
  decodeJwtHeader,
  isSupabaseAuthNetworkError,
  verifySupabaseAccessToken,
} from '../utils/verifySupabaseAccessToken.js';
import { verifySupabaseAccessTokenWithJwks } from '../utils/verifySupabaseAccessTokenJwks.js';
import {
  isLocalAuthMode,
  verifyLocalAccessToken,
} from '../services/local-auth.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pathWithoutQuery = (originalUrl) => {
  const s = originalUrl || '';
  const q = s.indexOf('?');
  return (q === -1 ? s : s.slice(0, q)).replace(/\/+$/, '') || '';
};

/** Apenas listagem raiz: GET /api/categories (sem /budgets/…). */
const isGetCategoriesCollection = (req) => {
  if (req.method !== 'GET') return false;
  const fromOriginal = pathWithoutQuery(req.originalUrl || '');
  const merged = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '');
  return (
    fromOriginal === '/api/categories' ||
    merged === '/api/categories'
  );
};

const resolveAutomationUserId = (req) => {
  const raw =
    (req.headers['x-meufinanceiro-user-id'] ||
      req.query?.userId ||
      req.query?.user_id ||
      '')
      .toString()
      .trim();
  if (!raw || !UUID_RE.test(raw)) return null;
  return raw;
};

const attachAutomationUser = (req, userId) => {
  req.authType = 'api_key';
  req.user = { id: userId };
  req.accessToken = null;
};

export const requireAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return next(unauthorized('Token ausente'));
    }

    const token = normalizeEnvSecret(
      authHeader.replace(/^Bearer\s+/i, '').trim(),
    );

    // 🔑 1a. API_SECRET (automação) + utilizador alvo
    const apiSecret = normalizeEnvSecret(process.env.API_SECRET);
    if (apiSecret && token === apiSecret) {
      const userId = resolveAutomationUserId(req);
      if (!userId) {
        return next(
          badRequest(
            'Com Bearer API_SECRET envie o UUID do utilizador no header X-MeuFinanceiro-User-Id ou na query userId / user_id.',
          ),
        );
      }
      attachAutomationUser(req, userId);
      return next();
    }

    // 🔑 1b. Segundo segredo opcional (ex.: OpenClaw / n8n sem mexer no API_SECRET principal)
    const apiSecretOp = normalizeEnvSecret(process.env.API_SECRET_OP);
    if (apiSecretOp && token === apiSecretOp) {
      const userId = resolveAutomationUserId(req);
      if (!userId) {
        return next(
          badRequest(
            'Com Bearer API_SECRET_OP envie o UUID do utilizador no header X-MeuFinanceiro-User-Id ou na query userId / user_id.',
          ),
        );
      }
      attachAutomationUser(req, userId);
      return next();
    }

    // 🔑 2. Mesmo Bearer do OpenClaw só para GET /api/categories (robô + lista minimal/full)
    const clawSecret = normalizeEnvSecret(
      process.env.OPENCLAW_WEBHOOK_SECRET
      || process.env.HERMES_WEBHOOK_SECRET
      || '',
    );
    if (
      clawSecret &&
      token === clawSecret &&
      isGetCategoriesCollection(req)
    ) {
      const userId = resolveAutomationUserId(req);
      if (!userId) {
        return next(
          badRequest(
            'Com Bearer OPENCLAW_WEBHOOK_SECRET neste GET envie X-MeuFinanceiro-User-Id ou query userId / user_id com UUID do utilizador.',
          ),
        );
      }
      attachAutomationUser(req, userId);
      return next();
    }

    // 🔐 3a. Auth local (EasyPanel / AUTH_MODE=local)
    if (isLocalAuthMode()) {
      const localUser = verifyLocalAccessToken(token);
      if (localUser) {
        req.user = localUser;
        req.accessToken = token;
        req.authType = 'user';
        return next();
      }
      return next(unauthorized('Sessão inválida ou expirada. Faça login novamente.'));
    }

    // 🔐 3b. JWT do Supabase (utilizador real) — validação local (sem round-trip Auth)
    const jwtHeader = decodeJwtHeader(token);
    const jwtSecret = env.SUPABASE_JWT_SECRET;

    if (!jwtHeader?.alg || jwtHeader.alg === 'HS256') {
      const localUser = verifySupabaseAccessToken(token, jwtSecret);
      if (localUser) {
        req.user = localUser;
        req.accessToken = token;
        req.authType = 'user';
        return next();
      }
    }

    if (jwtHeader?.alg && ['RS256', 'ES256'].includes(jwtHeader.alg)) {
      const jwksUser = await verifySupabaseAccessTokenWithJwks(token, env.SUPABASE_URL);
      if (jwksUser) {
        req.user = jwksUser;
        req.accessToken = token;
        req.authType = 'user';
        return next();
      }
    }

    if (jwtSecret || jwtHeader?.alg) {
      return next(
        unauthorized(
          jwtHeader?.alg && jwtHeader.alg !== 'HS256'
            ? 'Sessão inválida ou expirada. Saia e entre novamente. Se persistir, verifique conexão com o Supabase.'
            : 'Sessão inválida. Em Supabase → Settings → JWT Keys → aba Legacy JWT Secret, copie o secret completo para SUPABASE_JWT_SECRET no .env e reinicie o backend.',
        ),
      );
    }

    const supabase = createSupabaseClient({ accessToken: token });
    const { data, error } = await supabase.auth.getUser();

    if (!error && data?.user) {
      req.user = data.user;
      req.accessToken = token;
      req.authType = 'user';
      return next();
    }

    if (error && isSupabaseAuthNetworkError(error)) {
      return next(
        serviceUnavailable(
          'Serviço de autenticação temporariamente indisponível. Adicione SUPABASE_JWT_SECRET no .env do backend (Supabase → Settings → API) e reinicie.',
          { code: 'auth_upstream_timeout' },
        ),
      );
    }

    // ❌ 4. Se não passou em nenhum
    return next(unauthorized('Não autenticado'));

  } catch (error) {
    return next(error);
  }
};