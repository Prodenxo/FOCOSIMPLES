import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeNfseXmlSafeText,
  sanitizeNfseXmlSafeTextInEmitPayload,
} from '../src/services/nfse-xml-safe-text.js';

test('sanitizeNfseXmlSafeText troca travessão e en-dash por hífen', () => {
  assert.equal(
    sanitizeNfseXmlSafeText('Teste automatizado Foco Simples — redes 071601'),
    'Teste automatizado Foco Simples - redes 071601',
  );
  assert.equal(
    sanitizeNfseXmlSafeText('Serviço – obra'),
    'Serviço - obra',
  );
  assert.equal(sanitizeNfseXmlSafeText('já com hífen - ok'), 'já com hífen - ok');
  assert.equal(sanitizeNfseXmlSafeText(null), null);
});

test('sanitizeNfseXmlSafeTextInEmitPayload limpa discriminacao do serviço', () => {
  const payload = {
    descricao: 'Nota — teste',
    servico: [{ discriminacao: 'Teste automatizado Foco Simples — gesso 070602' }],
  };
  const out = sanitizeNfseXmlSafeTextInEmitPayload(payload);
  assert.equal(out.descricao, 'Nota - teste');
  assert.equal(out.servico[0].discriminacao, 'Teste automatizado Foco Simples - gesso 070602');
});
