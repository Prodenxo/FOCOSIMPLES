import { env } from '../config/env.js';
import { query } from '../config/pg.js';
import {
  estimateAudioCostUsd,
  estimateChatCostUsd,
  estimateUsageFromTexts,
  normalizeOpenAiModel,
  roundUsd,
} from '../lib/openai-pricing.js';
import { resolveWhatsappChatConfig } from './whatsapp-chat-llm.service.js';

const FX_CACHE_MS = 6 * 60 * 60 * 1000;
const FALLBACK_USD_BRL = 5.5;
const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

let tableReady = false;
/** @type {{ rate: number, source: string, fetchedAt: number } | null} */
let fxCache = null;

const SOURCES = new Set(['whatsapp_agent', 'preview', 'transcription']);

export const normalizeUsagePhone = (rawPhone) =>
  String(rawPhone || '').replace(/\D/g, '');

const ensureTable = async () => {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS public.openai_usage_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      source text NOT NULL,
      model text NOT NULL,
      phone text,
      user_id uuid,
      prompt_tokens integer NOT NULL DEFAULT 0,
      completion_tokens integer NOT NULL DEFAULT 0,
      total_tokens integer NOT NULL DEFAULT 0,
      audio_seconds numeric(10,2) NOT NULL DEFAULT 0,
      cost_usd numeric(12,6) NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_openai_usage_events_created
    ON public.openai_usage_events (created_at DESC)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_openai_usage_events_phone_created
    ON public.openai_usage_events (phone, created_at DESC)
  `);
  tableReady = true;
};

const resolveUserIdFromPhone = async (phone) => {
  const digits = normalizeUsagePhone(phone);
  if (digits.length < 10) return null;
  try {
    const { rows } = await query(
      `
      SELECT user_id
      FROM public.n8n_link
      WHERE user_id IS NOT NULL
        AND regexp_replace(COALESCE(user_number, ''), '\\D', '', 'g') = $1
      LIMIT 1
      `,
      [digits],
    );
    return rows[0]?.user_id || null;
  } catch {
    return null;
  }
};

export const recordOpenAiUsage = async ({
  source = 'whatsapp_agent',
  model,
  phone,
  userId,
  usage,
  audioSeconds = 0,
  createdAt,
} = {}) => {
  const safeSource = SOURCES.has(source) ? source : 'whatsapp_agent';
  const safeModel = normalizeOpenAiModel(model);
  const digits = normalizeUsagePhone(phone) || null;
  const promptTokens = Math.max(0, Number(usage?.prompt_tokens) || 0);
  const completionTokens = Math.max(0, Number(usage?.completion_tokens) || 0);
  const totalTokens = Math.max(
    0,
    Number(usage?.total_tokens) || promptTokens + completionTokens,
  );
  const seconds = Math.max(0, Number(audioSeconds) || 0);
  const costUsd = roundUsd(
    safeSource === 'transcription'
      ? estimateAudioCostUsd({ model: safeModel, audioSeconds: seconds })
      : estimateChatCostUsd({
        model: safeModel,
        promptTokens,
        completionTokens,
      }),
  );
  if (totalTokens <= 0 && seconds <= 0 && costUsd <= 0) return null;
  try {
    await ensureTable();
    const resolvedUserId = userId || await resolveUserIdFromPhone(digits);
    const { rows } = await query(
      `
      INSERT INTO public.openai_usage_events (
        source, model, phone, user_id,
        prompt_tokens, completion_tokens, total_tokens,
        audio_seconds, cost_usd, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))
      RETURNING id
      `,
      [
        safeSource,
        safeModel,
        digits,
        resolvedUserId,
        promptTokens,
        completionTokens,
        totalTokens,
        seconds,
        costUsd,
        createdAt ? new Date(createdAt).toISOString() : null,
      ],
    );
    return rows[0] || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[openai-usage] gravar falhou:', msg);
    return null;
  }
};

export const resolveUsagePeriodRange = (period = 'month', now = new Date()) => {
  const safe = ['month', '7d', 'today'].includes(period) ? period : 'month';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const todayStart = new Date(`${year}-${month}-${day}T00:00:00-03:00`);
  const to = now;
  if (safe === 'today') {
    return { period: safe, from: todayStart, to };
  }
  if (safe === '7d') {
    return {
      period: safe,
      from: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
      to,
    };
  }
  return { period: safe, from: new Date(`${year}-${month}-01T00:00:00-03:00`), to };
};

export const getUsdBrlRate = async () => {
  const explicit = Number.parseFloat(String(env.OPENAI_USD_BRL || '').replace(',', '.'));
  if (Number.isFinite(explicit) && explicit > 0) {
    return { rate: explicit, source: 'env' };
  }
  if (fxCache && Date.now() - fxCache.fetchedAt < FX_CACHE_MS) {
    return { rate: fxCache.rate, source: fxCache.source };
  }
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(4000) });
    const payload = await res.json().catch(() => ({}));
    const bid = Number.parseFloat(payload?.USDBRL?.bid);
    if (Number.isFinite(bid) && bid > 0) {
      fxCache = { rate: bid, source: 'awesomeapi', fetchedAt: Date.now() };
      return { rate: bid, source: 'awesomeapi' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[openai-usage] câmbio falhou:', msg);
  }
  fxCache = { rate: FALLBACK_USD_BRL, source: 'fallback', fetchedAt: Date.now() };
  return { rate: FALLBACK_USD_BRL, source: 'fallback' };
};

export const backfillOpenAiUsageFromLogs = async ({ from, to } = {}) => {
  await ensureTable();
  const model = resolveWhatsappChatConfig().model;
  let rows = [];
  try {
    const result = await query(
      `
      SELECT
        a.phone,
        a.source,
        a.content AS assistant_content,
        a.created_at,
        (
          SELECT u.content
          FROM public.whatsapp_backend_agent_logs u
          WHERE u.phone = a.phone
            AND u.role = 'user'
            AND u.created_at <= a.created_at
          ORDER BY u.created_at DESC
          LIMIT 1
        ) AS user_content
      FROM public.whatsapp_backend_agent_logs a
      WHERE a.role = 'assistant'
        AND a.created_at >= $1
        AND a.created_at < $2
        AND NOT EXISTS (
          SELECT 1
          FROM public.openai_usage_events e
          WHERE e.phone = a.phone
            AND e.created_at BETWEEN a.created_at - interval '3 minutes'
              AND a.created_at + interval '3 minutes'
        )
      ORDER BY a.created_at ASC
      LIMIT 500
      `,
      [new Date(from).toISOString(), new Date(to).toISOString()],
    );
    rows = result.rows || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[openai-usage] não deu para ler logs antigos:', msg);
    return 0;
  }

  let inserted = 0;
  for (const row of rows) {
    const usage = estimateUsageFromTexts({
      promptText: row.user_content || '',
      completionText: row.assistant_content || '',
    });
    const saved = await recordOpenAiUsage({
      source: row.source === 'preview' ? 'preview' : 'whatsapp_agent',
      model,
      phone: row.phone,
      usage,
      createdAt: row.created_at,
    });
    if (saved) inserted += 1;
  }
  return inserted;
};

export const getOpenAiUsageDashboard = async ({ period = 'month' } = {}) => {
  await ensureTable();
  const range = resolveUsagePeriodRange(period);
  await backfillOpenAiUsageFromLogs({ from: range.from, to: range.to });
  const fx = await getUsdBrlRate();
  const { rows: totalsRows } = await query(
    `
    SELECT
      COUNT(*)::int AS calls,
      COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(audio_seconds), 0)::numeric AS audio_seconds,
      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
    FROM public.openai_usage_events
    WHERE created_at >= $1 AND created_at < $2
    `,
    [range.from.toISOString(), range.to.toISOString()],
  );
  const { rows: byUser } = await query(
    `
    SELECT
      COALESCE(NULLIF(e.phone, ''), 'sem_telefone') AS phone,
      e.user_id,
      COALESCE(
        NULLIF(u.raw_user_meta_data->>'display_name', ''),
        NULLIF(u.email, ''),
        NULLIF(e.phone, ''),
        'desconhecido'
      ) AS label,
      COUNT(*)::int AS calls,
      COALESCE(SUM(e.total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(e.cost_usd), 0)::numeric AS cost_usd
    FROM public.openai_usage_events e
    LEFT JOIN public.users u ON u.id = e.user_id
    WHERE e.created_at >= $1 AND e.created_at < $2
    GROUP BY 1, 2, 3
    ORDER BY cost_usd DESC, tokens DESC
    LIMIT 80
    `,
    [range.from.toISOString(), range.to.toISOString()],
  );
  const { rows: bySource } = await query(
    `
    SELECT
      source,
      COUNT(*)::int AS calls,
      COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
    FROM public.openai_usage_events
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY source
    ORDER BY cost_usd DESC
    `,
    [range.from.toISOString(), range.to.toISOString()],
  );

  const toMoney = (usd) => {
    const costUsd = Number(usd) || 0;
    return {
      costUsd: roundUsd(costUsd),
      costBrl: roundUsd(costUsd * fx.rate),
    };
  };

  const totalsRaw = totalsRows[0] || {};
  const totalsMoney = toMoney(totalsRaw.cost_usd);

  return {
    period: range.period,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    usdBrl: fx.rate,
    usdBrlSource: fx.source,
    totals: {
      calls: Number(totalsRaw.calls) || 0,
      promptTokens: Number(totalsRaw.prompt_tokens) || 0,
      completionTokens: Number(totalsRaw.completion_tokens) || 0,
      totalTokens: Number(totalsRaw.total_tokens) || 0,
      audioSeconds: Number(totalsRaw.audio_seconds) || 0,
      ...totalsMoney,
    },
    byUser: byUser.map((row) => ({
      phone: row.phone,
      userId: row.user_id,
      label: row.label,
      calls: Number(row.calls) || 0,
      tokens: Number(row.tokens) || 0,
      ...toMoney(row.cost_usd),
    })),
    bySource: bySource.map((row) => ({
      source: row.source,
      calls: Number(row.calls) || 0,
      tokens: Number(row.tokens) || 0,
      ...toMoney(row.cost_usd),
    })),
    note:
      'Chat DeepSeek (robô do site) + transcrição OpenAI. OpenClaw não entra. Valores são estimativa em USD→BRL.',
  };
};
