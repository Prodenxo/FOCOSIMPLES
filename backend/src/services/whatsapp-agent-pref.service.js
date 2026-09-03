import { query } from '../config/pg.js';
import { env } from '../config/env.js';
import { resolveUserIdByPhone } from './openclaw-bot.service.js';

const ENGINES = new Set(['openclaw', 'backend']);

let tableReady = false;

export const normalizeWhatsappEngine = (value) => {
  const engine = String(value || '').trim().toLowerCase();
  return ENGINES.has(engine) ? engine : 'openclaw';
};

export const isWhatsappBackendAgentConfigured = () =>
  Boolean((env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim());

const ensureTable = async () => {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS public.whatsapp_agent_prefs (
      user_id uuid PRIMARY KEY,
      engine text NOT NULL DEFAULT 'openclaw'
        CHECK (engine = ANY (ARRAY['openclaw', 'backend'])),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
};

export const getWhatsappEngineForUser = async (userId) => {
  if (!userId) return 'openclaw';
  try {
    await ensureTable();
    const { rows } = await query(
      'SELECT engine FROM public.whatsapp_agent_prefs WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    return normalizeWhatsappEngine(rows?.[0]?.engine);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[whatsapp-agent-pref] leitura falhou, usando OpenClaw:', msg);
    return 'openclaw';
  }
};

export const setWhatsappEngineForUser = async (userId, engine) => {
  const next = normalizeWhatsappEngine(engine);
  await ensureTable();
  await query(
    `
    INSERT INTO public.whatsapp_agent_prefs (user_id, engine, updated_at)
    VALUES ($1, $2, now())
    ON CONFLICT (user_id) DO UPDATE
    SET engine = EXCLUDED.engine, updated_at = now()
    `,
    [userId, next],
  );
  return next;
};

/** Só o número ligado a um usuário com engine=backend sai do OpenClaw. */
export const shouldUseBackendWhatsappAgent = async (rawPhone) => {
  try {
    const userId = await resolveUserIdByPhone(rawPhone);
    if (!userId) return false;
    const engine = await getWhatsappEngineForUser(userId);
    return engine === 'backend';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[whatsapp-agent-pref] roteamento falhou, usando OpenClaw:', msg);
    return false;
  }
};

export const buildWhatsappAgentPrefView = ({
  engine,
  phoneLinked = false,
}) => {
  const resolved = normalizeWhatsappEngine(engine);
  return {
    openclawEnabled: resolved === 'openclaw',
    engine: resolved,
    backendReady: isWhatsappBackendAgentConfigured(),
    phoneLinked: Boolean(phoneLinked),
  };
};
