import { env } from '../config/env.js';
import { runOpenclawAction } from './openclaw-bot.service.js';
import { sendWhatsappMessage } from './whatsapp-outbound.service.js';
import {
  WHATSAPP_BACKEND_AGENT_ACTIONS,
  WHATSAPP_BACKEND_AGENT_SYSTEM_PROMPT,
} from './whatsapp-backend-agent-prompt.js';

const HISTORY_LIMIT = 16;
const MAX_TOOL_TURNS = 8;
const OPENAI_TIMEOUT_MS = 45_000;
const sessions = new Map();

const SEND_FILE_ACTIONS = new Set([
  'send_das_whatsapp',
  'send_nfse_whatsapp',
  'send_nfe_whatsapp',
  'send_text_whatsapp',
]);

export const summarizeActionResult = (result) => {
  if (result == null) return { ok: false, message: 'Sem resposta' };
  const clone = JSON.parse(JSON.stringify(result, (key, value) => {
    if (/base64|pdf|xml|certificado|password|secret|token/i.test(String(key))) {
      return typeof value === 'string' && value.length > 80 ? '[omitido]' : value;
    }
    if (typeof value === 'string' && value.length > 1200) {
      return `${value.slice(0, 400)}…`;
    }
    return value;
  }));
  return clone;
};

const getSession = (phone) => {
  const key = String(phone || '').replace(/\D/g, '');
  if (!key) return { key: '', messages: [] };
  const current = sessions.get(key) || { messages: [] };
  return { key, ...current };
};

const saveSession = (key, messages) => {
  if (!key) return;
  sessions.set(key, {
    messages: messages.slice(-HISTORY_LIMIT),
    updatedAt: Date.now(),
  });
};

const openaiTools = [
  {
    type: 'function',
    function: {
      name: 'app_action',
      description: 'Executa uma ação do Foco Simples (lançamento, agenda, DAS, nota).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: WHATSAPP_BACKEND_AGENT_ACTIONS,
          },
          payload: {
            type: 'object',
            additionalProperties: true,
            description: 'Dados da ação. Vazio se não precisar.',
          },
        },
        required: ['action'],
      },
    },
  },
];

const callOpenAi = async (messages) => {
  const apiKey = (env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY ausente');
  }
  const model = (env.OPENAI_WHATSAPP_MODEL || process.env.OPENAI_WHATSAPP_MODEL || 'gpt-4o-mini').trim();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = payload?.error?.message || res.statusText;
      throw new Error(`OpenAI ${res.status}: ${detail}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

const parseToolArgs = (raw) => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const handleWhatsappBackendAgent = async ({
  phone,
  text,
  deliverWhatsapp = true,
}) => {
  const trimmed = String(text || '').trim();
  const session = getSession(phone);
  if (!session.key) {
    return { ok: false, replySent: false, reply: '', reason: 'no_phone' };
  }
  if (!trimmed) {
    return { ok: false, replySent: false, reply: '', reason: 'empty_text' };
  }

  const history = [...session.messages, { role: 'user', content: trimmed }];
  const messages = [
    { role: 'system', content: WHATSAPP_BACKEND_AGENT_SYSTEM_PROMPT },
    ...history,
  ];

  let replySent = false;
  let lastAssistant = '';

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      const completion = await callOpenAi(messages);
      const choice = completion?.choices?.[0]?.message;
      if (!choice) break;

      const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
      if (toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: choice.content || null,
          tool_calls: toolCalls,
        });
        for (const call of toolCalls) {
          const args = parseToolArgs(call?.function?.arguments);
          const action = String(args.action || '').trim();
          const payload = args.payload && typeof args.payload === 'object' ? args.payload : {};
          let result;
          try {
            result = await runOpenclawAction({
              phone,
              senderPhone: phone,
              action,
              payload,
            });
          } catch (err) {
            result = {
              ok: false,
              message: err instanceof Error ? err.message : String(err),
            };
          }
          if (SEND_FILE_ACTIONS.has(action) && result?.ok !== false) {
            replySent = true;
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(summarizeActionResult(result)),
          });
        }
        continue;
      }

      lastAssistant = String(choice.content || '').trim();
      break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[whatsapp-backend-agent] falhou:', msg);
    lastAssistant =
      'Não consegui concluir agora. Tente de novo em instantes. Se persistir, ligue de novo o OpenClaw em Configurações.';
  }

  if (lastAssistant) {
    history.push({ role: 'assistant', content: lastAssistant });
    saveSession(session.key, history);
    if (!replySent && deliverWhatsapp) {
      try {
        await sendWhatsappMessage({
          phone,
          message: lastAssistant,
          source: 'backend_whatsapp_agent',
        });
        replySent = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[whatsapp-backend-agent] envio WhatsApp falhou:', msg);
      }
    }
  } else {
    saveSession(session.key, history);
  }

  return { ok: true, replySent, reply: lastAssistant, mode: 'backend' };
};

export const __resetWhatsappBackendAgentSessionsForTests = () => {
  sessions.clear();
};
