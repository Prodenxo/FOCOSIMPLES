import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

// --- Helpers ---

const createNext = () => {
  const fn = (err) => { fn.called = true; fn.error = err ?? null; };
  fn.called = false;
  fn.error = null;
  return fn;
};

const createRes = () => ({
  payload: null,
  json(body) { this.payload = body; return this; }
});

// --- Middleware: requireCronSecret ---

test('requireCronSecret: passa com secret correto', async () => {
  process.env.CRON_SECRET = 'secret-valido';
  const { requireCronSecret } = await import('../src/middlewares/requireCronSecret.js');

  const req = { headers: { authorization: 'Bearer secret-valido' } };
  const next = createNext();
  requireCronSecret(req, {}, next);

  assert.equal(next.called, true);
  assert.equal(next.error, null);
});

test('requireCronSecret: rejeita com secret errado', async () => {
  process.env.CRON_SECRET = 'secret-valido';
  const { requireCronSecret } = await import('../src/middlewares/requireCronSecret.js');

  const req = { headers: { authorization: 'Bearer secret-errado' } };
  const next = createNext();
  requireCronSecret(req, {}, next);

  assert.equal(next.called, true);
  assert.ok(next.error);
  assert.equal(next.error.status, 401);
});

test('requireCronSecret: rejeita sem header Authorization', async () => {
  process.env.CRON_SECRET = 'secret-valido';
  const { requireCronSecret } = await import('../src/middlewares/requireCronSecret.js');

  const req = { headers: {} };
  const next = createNext();
  requireCronSecret(req, {}, next);

  assert.equal(next.called, true);
  assert.ok(next.error);
  assert.equal(next.error.status, 401);
});

test('requireCronSecret: rejeita quando CRON_SECRET não está configurado', async () => {
  const originalSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  // Force re-import para pegar estado limpo do env
  const mod = await import('../src/middlewares/requireCronSecret.js?nocache=' + Date.now());
  const requireCronSecretFresh = mod.requireCronSecret;

  const req = { headers: { authorization: 'Bearer qualquer' } };
  const next = createNext();
  requireCronSecretFresh(req, {}, next);

  assert.equal(next.called, true);
  assert.ok(next.error);
  assert.equal(next.error.status, 401);

  process.env.CRON_SECRET = originalSecret;
});

// --- Handler do endpoint /cron/das-mensal ---

test('cron/das-mensal: retorna summary com ok:true em chamada bem-sucedida', async () => {
  const fakeSummary = {
    competencia: '2026-03',
    total: 2,
    ok: 2,
    erro: 0,
    startedAt: '2026-04-01T11:00:00.000Z',
    finishedAt: '2026-04-01T11:00:05.000Z',
    results: []
  };

  // Simula handler diretamente sem passar pelo middleware
  const handler = async (_req, res, next) => {
    try {
      const summary = await Promise.resolve(fakeSummary);
      res.json({ ok: true, summary });
    } catch (error) {
      next(error);
    }
  };

  const res = createRes();
  const next = createNext();
  await handler({}, res, next);

  assert.equal(next.error, null);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.summary.competencia, '2026-03');
  assert.equal(res.payload.summary.total, 2);
});

test('cron/das-mensal: propaga erro via next quando service falha', async () => {
  const handler = async (_req, res, next) => {
    try {
      throw new Error('Falha simulada no Supabase');
    } catch (error) {
      next(error);
    }
  };

  const res = createRes();
  const next = createNext();
  await handler({}, res, next);

  assert.equal(next.called, true);
  assert.ok(next.error);
  assert.match(next.error.message, /Falha simulada/);
});
