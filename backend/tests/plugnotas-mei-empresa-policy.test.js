import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMeiRegimePatchPayload,
  normalizeMeiEmpresaPayload,
} from '../src/services/plugnotas/plugnotas-mei-empresa-policy.js';

test('normalizeMeiEmpresaPayload no Foco Simples assume Simples sem MEI', () => {
  const payload = { cpfCnpj: '17422651000172' };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.simplesNacional, true);
  assert.equal(payload.regimeTributarioEspecial, 0);
});

test('normalizeMeiEmpresaPayload no Foco Simples zera especial MEI', () => {
  const payload = {
    regimeTributario: 1,
    simplesNacional: true,
    regimeTributarioEspecial: 5,
  };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributarioEspecial, 0);
});

test('normalizeMeiEmpresaPayload: regime 4 vira Simples sem MEI', () => {
  const payload = { regimeTributario: 4 };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.regimeTributarioEspecial, 0);
  assert.equal(payload.simplesNacional, true);
});

test('buildMeiRegimePatchPayload no Foco Simples não marca MEI', () => {
  const payload = buildMeiRegimePatchPayload('17422651000172', 'cert-abc');
  assert.equal(payload.cpfCnpj, '17422651000172');
  assert.equal(payload.certificado, 'cert-abc');
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.regimeTributarioEspecial, 0);
  assert.equal(payload.inscricaoEstadual, 'ISENTO');
});
