import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IBPT_FALLBACK_BY_NCM_CHAPTER,
  resolveIbptFallbackAliquotas,
} from '../src/lib/ibpt-fallback-aliquotas.js';
import { calcularValorTributosIbpt } from '../src/services/ibpt.service.js';

describe('ibpt-fallback-aliquotas', () => {
  it('capítulo 22 (bebidas) soma 31.45% sobre valor do produto', () => {
    const rates = resolveIbptFallbackAliquotas('22030000');
    const total = calcularValorTributosIbpt(rates, 100, '0');
    assert.equal(total, 31.45);
    assert.equal(rates.fonte, 'IBPT');
  });

  it('possui entradas para segmentos varejo comuns', () => {
    assert.ok(IBPT_FALLBACK_BY_NCM_CHAPTER['22']);
    assert.ok(IBPT_FALLBACK_BY_NCM_CHAPTER['30']);
    assert.ok(IBPT_FALLBACK_BY_NCM_CHAPTER['84']);
  });
});
