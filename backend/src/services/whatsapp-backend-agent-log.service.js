import { query } from '../config/pg.js';

const MAX_CONTENT = 4000;
const THREAD_LIMIT = 80;
const MESSAGE_LIMIT = 200;

let tableReady = false;

export const normalizeLogPhone = (rawPhone) =>
  String(rawPhone || '').replace(/\D/g, '');

const clipContent = (value) => {
  const text = String(value || '').trim();
  if (text.length <= MAX_CONTENT) return text;
  return `${text.slice(0, MAX_CONTENT)}…`;
};

const ensureTable = async () => {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS public.whatsapp_backend_agent_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone text NOT NULL,
      role text NOT NULL CHECK (role = ANY (ARRAY['user', 'assistant'])),
      content text NOT NULL,
      source text NOT NULL DEFAULT 'whatsapp',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_whatsapp_backend_agent_logs_phone_created
    ON public.whatsapp_backend_agent_logs (phone, created_at DESC)
  `);
  tableReady = true;
};

export const appendWhatsappBackendAgentLog = async ({
  phone,
  role,
  content,
  source = 'whatsapp',
}) => {
  const digits = normalizeLogPhone(phone);
  const text = clipContent(content);
  const safeRole = role === 'assistant' ? 'assistant' : 'user';
  const safeSource = source === 'preview' ? 'preview' : 'whatsapp';
  if (!digits || !text) return null;
  try {
    await ensureTable();
    const { rows } = await query(
      `
      INSERT INTO public.whatsapp_backend_agent_logs (phone, role, content, source)
      VALUES ($1, $2, $3, $4)
      RETURNING id, phone, role, content, source, created_at
      `,
      [digits, safeRole, text, safeSource],
    );
    return rows[0] || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[whatsapp-backend-agent-log] gravar falhou:', msg);
    return null;
  }
};

export const listWhatsappBackendAgentThreads = async () => {
  await ensureTable();
  const { rows } = await query(
    `
    SELECT
      phone,
      COUNT(*)::int AS message_count,
      MAX(created_at) AS last_at,
      (
        SELECT content
        FROM public.whatsapp_backend_agent_logs newest
        WHERE newest.phone = logs.phone
        ORDER BY newest.created_at DESC
        LIMIT 1
      ) AS last_content
    FROM public.whatsapp_backend_agent_logs logs
    GROUP BY phone
    ORDER BY last_at DESC
    LIMIT $1
    `,
    [THREAD_LIMIT],
  );
  return rows;
};

export const listWhatsappBackendAgentMessages = async (rawPhone) => {
  const digits = normalizeLogPhone(rawPhone);
  if (!digits) return [];
  await ensureTable();
  const { rows } = await query(
    `
    SELECT id, phone, role, content, source, created_at
    FROM public.whatsapp_backend_agent_logs
    WHERE phone = $1
    ORDER BY created_at ASC
    LIMIT $2
    `,
    [digits, MESSAGE_LIMIT],
  );
  return rows;
};
