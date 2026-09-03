import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateAudioCostUsd,
  estimateChatCostUsd,
  estimateTokensFromText,
  estimateUsageFromTexts,
  hasOpenAiUsageCounts,
  normalizeOpenAiModel,
} from '../src/lib/openai-pricing.js';
import { resolveUsagePeriodRange } from '../src/services/openai-usage.service.js';

test('normalizeOpenAiModel reconhece gpt-4o-mini e whisper', () => {
  assert.equal(normalizeOpenAiModel('GPT-4o-mini'), 'gpt-4o-mini');
  assert.equal(normalizeOpenAiModel('whisper-1'), 'whisper-1');
});

test('estimateChatCostUsd: 1 milhão de entrada + 1 milhão de saída no mini', () => {
  const usd = estimateChatCostUsd({
    model: 'gpt-4o-mini',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.equal(usd, 0.75);
});

test('estimateAudioCostUsd: 1 minuto de whisper', () => {
  assert.equal(estimateAudioCostUsd({ model: 'whisper-1', audioSeconds: 60 }), 0.006);
});

test('resolveUsagePeriodRange: mês começa no dia 1 em Brasília', () => {
  const now = new Date('2026-09-03T14:00:00-03:00');
  const range = resolveUsagePeriodRange('month', now);
  assert.equal(range.period, 'month');
  assert.equal(range.from.toISOString(), new Date('2026-09-01T00:00:00-03:00').toISOString());
  assert.equal(range.to.toISOString(), now.toISOString());
});

test('estimateTokensFromText conta texto em português', () => {
  assert.equal(estimateTokensFromText('abc'), 1);
  assert.ok(estimateTokensFromText('Reunião com Gabriel Brito') >= 7);
});

test('estimateUsageFromTexts junta pergunta e resposta', () => {
  const usage = estimateUsageFromTexts({
    promptText: 'saldo',
    completionText: 'Seu saldo é 10',
  });
  assert.ok(usage.total_tokens > 0);
  assert.equal(usage.total_tokens, usage.prompt_tokens + usage.completion_tokens);
});

test('hasOpenAiUsageCounts exige tokens', () => {
  assert.equal(hasOpenAiUsageCounts({}), false);
  assert.equal(hasOpenAiUsageCounts({ prompt_tokens: 12 }), true);
});

test('resolveUsagePeriodRange: hoje começa à meia-noite de Brasília', () => {
  const now = new Date('2026-09-03T14:00:00-03:00');
  const range = resolveUsagePeriodRange('today', now);
  assert.equal(range.from.toISOString(), new Date('2026-09-03T00:00:00-03:00').toISOString());
});
