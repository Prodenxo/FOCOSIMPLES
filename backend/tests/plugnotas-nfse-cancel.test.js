import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNfseCancelPayload,
  resolveNfseCancelPath,
} from '../src/services/plugnotas/nfse.service.js';

test('resolveNfseCancelPath — usa rota oficial Plugnotas /nfse/cancelar/:id', () => {
  assert.equal(
    resolveNfseCancelPath('6a2824f24b17b5e281d98ff9'),
    '/nfse/cancelar/6a2824f24b17b5e281d98ff9',
  );
});

test('resolveNfseCancelPath — codifica caracteres especiais no id', () => {
  assert.equal(resolveNfseCancelPath('id com espaço'), '/nfse/cancelar/id%20com%20espa%C3%A7o');
});

test('buildNfseCancelPayload — mapeia reason para motivo e default codigo 9', () => {
  assert.deepEqual(buildNfseCancelPayload({ reason: 'Erro na emissão' }), {
    codigo: '9',
    motivo: 'Erro na emissão',
  });
});

test('buildNfseCancelPayload — aceita codigo explícito (ex.: 1 = Erro na Emissão)', () => {
  assert.deepEqual(buildNfseCancelPayload({ codigo: '1', reason: 'Nota duplicada' }), {
    codigo: '1',
    motivo: 'Nota duplicada',
  });
});
