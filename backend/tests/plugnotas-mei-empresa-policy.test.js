import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNfseNationalContractPolicy,
  buildMeiRegimePatchPayload,
  normalizeMeiEmpresaPayload,
} from '../src/services/plugnotas/plugnotas-mei-empresa-policy.js';
import { env } from '../src/config/env.js';

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

test('applyNfseNationalContractPolicy preserva IM informada (municípios que exigem / E0116)', () => {
  const prev = env.APP_PRODUCT;
  env.APP_PRODUCT = 'focosimples';
  try {
    const payload = {
      cpfCnpj: '17422651000172',
      inscricaoMunicipal: '12345',
      nfse: { ativo: true, config: { nfseNacional: true } },
    };
    applyNfseNationalContractPolicy(payload);
    assert.equal(payload.inscricaoMunicipal, '12345');
  } finally {
    env.APP_PRODUCT = prev;
  }
});

test('applyNfseNationalContractPolicy limpa IM ausente ou igual ao CNPJ (E0120 / CNC)', () => {
  const prev = env.APP_PRODUCT;
  env.APP_PRODUCT = 'focosimples';
  try {
    const semIm = { nfse: { ativo: true, config: { nfseNacional: true } } };
    applyNfseNationalContractPolicy(semIm);
    assert.equal(semIm.inscricaoMunicipal, '');

    const imFantasma = {
      cpfCnpj: '17422651000172',
      inscricaoMunicipal: '17422651000172',
      nfse: { ativo: true, config: { nfseNacional: true } },
    };
    applyNfseNationalContractPolicy(imFantasma);
    assert.equal(imFantasma.inscricaoMunicipal, '');
  } finally {
    env.APP_PRODUCT = prev;
  }
});

test('buildMeiRegimePatchPayload no Foco Simples não marca MEI', () => {
  const payload = buildMeiRegimePatchPayload('17422651000172', 'cert-abc');
  assert.equal(payload.cpfCnpj, '17422651000172');
  assert.equal(payload.certificado, 'cert-abc');
  assert.equal(payload.regimeTributario, 1);
  assert.equal(payload.regimeTributarioEspecial, 0);
  assert.equal(payload.inscricaoEstadual, 'ISENTO');
});
