import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateChatCostUsd,
  normalizeOpenAiModel,
} from '../src/lib/openai-pricing.js';
import {
  isWhatsappChatLlmConfigured,
  normalizeWhatsappChatProvider,
  resolveWhatsappChatConfig,
} from '../src/services/whatsapp-chat-llm.service.js';

test('normalizeWhatsappChatProvider: deepseek é o padrão implícito', () => {
  assert.equal(normalizeWhatsappChatProvider(''), 'deepseek');
  assert.equal(normalizeWhatsappChatProvider('openai'), 'openai');
});

test('normalizeOpenAiModel reconhece deepseek-chat', () => {
  assert.equal(normalizeOpenAiModel('deepseek-chat'), 'deepseek-chat');
});

test('estimateChatCostUsd: deepseek-chat mais barato que gpt-4o-mini no output', () => {
  const deepseek = estimateChatCostUsd({
    model: 'deepseek-chat',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  const mini = estimateChatCostUsd({
    model: 'gpt-4o-mini',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.ok(deepseek < mini);
  assert.ok(Math.abs(deepseek - 0.42) < 0.001);
  assert.equal(mini, 0.75);
});

test('resolveWhatsappChatConfig usa DeepSeek quando DEEPSEEK_API_KEY está setada', () => {
  const prevProvider = process.env.WHATSAPP_CHAT_PROVIDER;
  const prevKey = process.env.DEEPSEEK_API_KEY;
  process.env.WHATSAPP_CHAT_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  try {
    const cfg = resolveWhatsappChatConfig();
    assert.equal(cfg.provider, 'deepseek');
    assert.equal(cfg.model, 'deepseek-chat');
    assert.equal(cfg.endpoint, 'https://api.deepseek.com/chat/completions');
    assert.equal(isWhatsappChatLlmConfigured(), true);
  } finally {
    if (prevProvider === undefined) delete process.env.WHATSAPP_CHAT_PROVIDER;
    else process.env.WHATSAPP_CHAT_PROVIDER = prevProvider;
    if (prevKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = prevKey;
  }
});
