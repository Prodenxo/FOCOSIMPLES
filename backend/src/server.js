import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { BACKEND_BUILD_ID } from './build-id.js';
import { env } from './config/env.js';
import { redactSensitiveUrlsForLog } from './utils/log-redact.js';
import routes from './routes/index.js';
import * as stripeWebhookController from './controllers/stripe-webhook.controller.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { startAgendaRemindersScheduler } from './services/agenda-reminders.scheduler.js';
import { startMonthlyDasScheduler } from './services/mei-das.service.js';
import { bootstrapDatabase } from './services/db-bootstrap.service.js';

const app = express();

/** APIs dinâmicas não devem usar ETag (304 + corpo vazio quebra clientes fetch). */
app.set('etag', false);

const normalizeOrigin = (value) => value.trim().replace(/\/$/, '');
const allowedOrigins = env.CORS_ORIGIN
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

/** Permite origens de preview da Vercel (*.vercel.app) além da lista explícita em CORS_ORIGIN. */
const isVercelPreviewOrigin = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(normalized)) return true;
  if (isVercelPreviewOrigin(normalized)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes('*') || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    if (isVercelPreviewOrigin(normalizedOrigin)) {
      return callback(null, true);
    }

    // eslint-disable-next-line no-console
    console.warn('[CORS] Origem bloqueada:', normalizedOrigin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

/** Responde ao preflight OPTIONS com headers CORS no início do pipeline (evita falha na Vercel). */
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();

  const origin = req.headers.origin;
  const allowOrigin = origin && isOriginAllowed(origin) ? origin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.status(204).end();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/** Stripe exige body bruto para validar `Stripe-Signature`. */
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res, next) => stripeWebhookController.postStripeWebhook(req, res, next)
);

app.use(express.json({ limit: '2mb' }));
morgan.token('url', (req) => redactSensitiveUrlsForLog(req.originalUrl || req.url || ''));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', buildId: BACKEND_BUILD_ID });
});

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    apiVersion: 2,
    buildId: BACKEND_BUILD_ID,
    routes: {
      meiGuide: '/api/mei-guide',
      meiGuideValidate: 'POST /api/mei-guide/validate',
      meiGuideRegenerate: 'POST /api/mei-guide/:periodo/regenerate',
      openclaw: '/api/bot/openclaw/action',
    },
  });
});

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});
app.use('/api', routes);

app.use(errorHandler);

const startServer = async () => {
  try {
    await bootstrapDatabase();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[backend] falha no bootstrap do banco', error instanceof Error ? error.message : error);
    // AUTH local: schema já vem dos SQLs easypanel — não derruba o servidor por DAS/agenda.
    if (String(env.AUTH_MODE || '').trim().toLowerCase() !== 'local') {
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.warn('[backend] AUTH_MODE=local — seguindo sem bootstrap DAS');
  }

  const server = app.listen(env.PORT, () => {
    startMonthlyDasScheduler();
    startAgendaRemindersScheduler();
    // eslint-disable-next-line no-console
    console.log(`[backend] rodando na porta ${env.PORT}`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[backend] sinal ${signal}, encerramento gracioso…`);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('[backend] HTTP encerrado');
      process.exit(0);
    });
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[backend] timeout no shutdown, a sair');
      process.exit(0);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (process.env.VERCEL !== '1') {
  void startServer();
}

export default app;


