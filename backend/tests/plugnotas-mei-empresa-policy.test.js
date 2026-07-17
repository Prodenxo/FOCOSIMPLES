import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMeiRegimePatchPayload,
  normalizeMeiEmpresaPayload,
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
} from '../src/services/plugnotas/plugnotas-mei-empresa-policy.js';

test('normalizeMeiEmpresaPayload: regime ausente assume Simples + MEI', () => {
  const payload = { cpfCnpj: '17422651000172' };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.simplesNacional, true);
  assert.equal(payload.regimeTributarioEspecial, PLUGNOTAS_REGIME_ESPECIAL_MEI);
});

test('normalizeMeiEmpresaPayload: Simples sem especial preenche MEI (5)', () => {
  const payload = {
    regimeTributario: 1,
    simplesNacional: true,
  };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributarioEspecial, PLUGNOTAS_REGIME_ESPECIAL_MEI);
});

test('normalizeMeiEmpresaPayload: regime 4 converte para 1 + especial 5', () => {
  const payload = { regimeTributario: 4 };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.regimeTributarioEspecial, PLUGNOTAS_REGIME_ESPECIAL_MEI);
  assert.equal(payload.simplesNacional, true);
});

test('normalizeMeiEmpresaPayload: não sobrescreve especial já definido', () => {
  const payload = {
    regimeTributario: 1,
    simplesNacional: true,
    regimeTributarioEspecial: 3,
  };
  normalizeMeiEmpresaPayload(payload);
  assert.equal(payload.regimeTributarioEspecial, 3);
});

test('buildMeiRegimePatchPayload inclui certificado quando informado', () => {
  const payload = buildMeiRegimePatchPayload('17422651000172', 'cert-abc');
  assert.equal(payload.cpfCnpj, '17422651000172');
  assert.equal(payload.certificado, 'cert-abc');
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.regimeTributarioEspecial, PLUGNOTAS_REGIME_ESPECIAL_MEI);
  assert.equal(payload.inscricaoEstadual, 'ISENTO');
});
