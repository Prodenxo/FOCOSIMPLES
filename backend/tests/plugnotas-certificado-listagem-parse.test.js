import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairCertificadoIdDeListagem,
  isPlausiblePlugnotasCertificadoId,
  normalizeCertificadoIdCandidate,
  normalizeCertificadoListItems
} from '../src/services/plugnotas/plugnotas-certificado-listagem-parse.js';

const CNPJ = '17422651000172';

test('normalizeCertificadoListItems lê data.items (aninhado)', () => {
  const payload = {
    data: {
      items: [{ id: 'cert-nested-items', cpfCnpj: CNPJ }]
    }
  };
  assert.equal(normalizeCertificadoListItems(payload).length, 1);
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), 'cert-nested-items');
});

test('normalizeCertificadoListItems lê result.data (objeto result)', () => {
  const payload = {
    result: { data: [{ uuid: 'abc-uuid-1', cnpj: CNPJ }] }
  };
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), 'abc-uuid-1');
});

test('normalizeCertificadoListItems trata data como registro único', () => {
  const payload = {
    data: { idCertificado: 'id-cert-str', cpfCnpj: CNPJ }
  };
  assert.equal(normalizeCertificadoListItems(payload).length, 1);
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), 'id-cert-str');
});

test('extrairCertificadoIdDeListagem lê id em certificado aninhado', () => {
  const payload = {
    data: [{
      cpfCnpj: CNPJ,
      certificado: { id: 'nested-cert-obj' }
    }]
  };
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), 'nested-cert-obj');
});

test('extrairCertificadoIdDeListagem aceita certificado como string ID', () => {
  const payload = {
    data: [{ cpfCnpj: CNPJ, certificado: 'direct-cert-ref' }]
  };
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), 'direct-cert-ref');
});

test('normalizeCertificadoListItems lê value na raiz (estilo OData)', () => {
  const payload = {
    value: [{ id: 555, documento: CNPJ }]
  };
  assert.equal(extrairCertificadoIdDeListagem(payload, CNPJ), '555');
});

test('normalizeCertificadoIdCandidate rejeita literais e só pontuação', () => {
  assert.equal(normalizeCertificadoIdCandidate('null'), null);
  assert.equal(normalizeCertificadoIdCandidate('undefined'), null);
  assert.equal(normalizeCertificadoIdCandidate('...---'), null);
});

test('normalizeCertificadoIdCandidate rejeita string excessivamente longa', () => {
  const long = `x${'a'.repeat(130)}`;
  assert.equal(normalizeCertificadoIdCandidate(long), null);
});

test('isPlausiblePlugnotasCertificadoId aceita UUID e ids alfanuméricos curtos', () => {
  assert.equal(isPlausiblePlugnotasCertificadoId('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isPlausiblePlugnotasCertificadoId('777'), true);
});
