import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenclawNfeEmitFingerprint,
  runOpenclawEmitWithDedup,
  __resetOpenclawEmitDedupForTests,
} from '../src/services/openclaw-nf-emit-dedup.service.js';

test('runOpenclawEmitWithDedup — segunda chamada usa cache recente', async () => {
  __resetOpenclawEmitDedupForTests();
  let calls = 0;
  const fp = 'user|NFE|07664865751|camiseta|39.9|1';
  const emitFn = async () => {
    calls += 1;
    return { id: 'nota-1', status: 'processando' };
  };

  const first = await runOpenclawEmitWithDedup(fp, emitFn);
  const second = await runOpenclawEmitWithDedup(fp, emitFn);

  assert.equal(calls, 1);
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.nota.id, 'nota-1');
});

test('runOpenclawEmitWithDedup — chamadas paralelas compartilham mesma emissão', async () => {
  __resetOpenclawEmitDedupForTests();
  let calls = 0;
  const fp = 'user|NFE|07664865751|camiseta|39.9|1';
  const emitFn = async () => {
    calls += 1;
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    return { id: 'nota-par', status: 'processando' };
  };

  const [a, b, c] = await Promise.all([
    runOpenclawEmitWithDedup(fp, emitFn),
    runOpenclawEmitWithDedup(fp, emitFn),
    runOpenclawEmitWithDedup(fp, emitFn),
  ]);

  assert.equal(calls, 1);
  assert.equal(a.deduplicated, false);
  assert.equal(b.deduplicated, true);
  assert.equal(c.deduplicated, true);
});

test('buildOpenclawNfeEmitFingerprint — usa catalogoProdutoId quando disponível', () => {
  const fp = buildOpenclawNfeEmitFingerprint('user-1', {
    destinatario: { cpfCnpj: '07664865751' },
    metadata: { catalogoProdutoId: 'prod-uuid-123' },
    itens: [{ codigo: 'X', descricao: 'Y', valor: 39.9, quantidade: 1 }],
  });
  assert.match(fp, /prod-uuid-123/);
  assert.match(fp, /39\.9/);
});
