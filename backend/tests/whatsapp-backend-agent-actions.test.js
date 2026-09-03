import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_CANONICAL_ACTIONS,
  OPENCLAW_INTERNAL_ACTIONS,
  WHATSAPP_BACKEND_AGENT_ACTIONS,
} from '../src/services/openclaw-actions.js';
import { buildWhatsappBackendAgentSystemPrompt } from '../src/services/whatsapp-backend-agent-prompt.js';

test('o robô do site tem todas as ações do OpenClaw, menos ping e envio interno', () => {
  const expected = OPENCLAW_CANONICAL_ACTIONS.filter(
    (action) => !OPENCLAW_INTERNAL_ACTIONS.includes(action),
  );
  assert.deepEqual([...WHATSAPP_BACKEND_AGENT_ACTIONS].sort(), [...expected].sort());
  assert.ok(WHATSAPP_BACKEND_AGENT_ACTIONS.includes('create_transaction'));
  assert.ok(WHATSAPP_BACKEND_AGENT_ACTIONS.includes('send_das_whatsapp'));
  assert.ok(WHATSAPP_BACKEND_AGENT_ACTIONS.includes('preview_nfe'));
  assert.ok(WHATSAPP_BACKEND_AGENT_ACTIONS.includes('create_calendar_event'));
  assert.ok(WHATSAPP_BACKEND_AGENT_ACTIONS.includes('list_access_requests'));
  assert.ok(!WHATSAPP_BACKEND_AGENT_ACTIONS.includes('send_text_whatsapp'));
});

test('o prompt carrega o SOUL inteiro e a camada do site', () => {
  const now = new Date('2026-09-03T15:00:00-03:00');
  const prompt = buildWhatsappBackendAgentSystemPrompt(now);
  assert.match(prompt, /app_action/);
  assert.match(prompt, /Consultor Financeiro Virtual/);
  assert.match(prompt, /create_transaction/);
  assert.match(prompt, /send_das_whatsapp/);
  assert.match(prompt, /2026-09-03/);
  assert.match(prompt, /2026-08-01/);
});
