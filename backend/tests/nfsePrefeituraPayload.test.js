import test from 'node:test';
import assert from 'node:assert/strict';

import { applyNfseConfigPrefeituraDeriveIbge } from '../src/services/plugnotas/nfsePrefeituraPayload.js';

test('derive desligado — não altera payload', () => {
  const payload = {
    endereco: { codigoCidade: '3550308' },
    nfse: { ativo: true, tipoContrato: 0, config: { producao: true } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, {}), false);
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: false }), false);
  assert.equal(hasPref(payload), false);
});

test('derive activo — adiciona prefeitura.codigoIbge a partir do endereço', () => {
  const payload = {
    endereco: { codigoCidade: '3550308' },
    nfse: { ativo: true, tipoContrato: 0, config: { producao: true } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), true);
  assert.deepEqual(payload.nfse.config.prefeitura, { codigoIbge: '3550308' });
});

test('merge: preserva login/senha e preenche codigoIbge em falta', () => {
  const payload = {
    endereco: { codigoCidade: '4115200' },
    nfse: {
      ativo: true,
      config: {
        producao: true,
        prefeitura: { login: 'u', senha: 'p' }
      }
    }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), true);
  assert.deepEqual(payload.nfse.config.prefeitura, {
    login: 'u',
    senha: 'p',
    codigoIbge: '4115200'
  });
});

test('não sobrescreve codigoIbge existente', () => {
  const payload = {
    endereco: { codigoCidade: '9999999' },
    nfse: {
      ativo: true,
      config: {
        prefeitura: { codigoIbge: '3550308', login: 'x' }
      }
    }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), false);
  assert.equal(payload.nfse.config.prefeitura.codigoIbge, '3550308');
});

test('nfse.ativo false — no-op', () => {
  const payload = {
    endereco: { codigoCidade: '3550308' },
    nfse: { ativo: false, config: { producao: true } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), false);
});

test('codigoCidade inválido — no-op', () => {
  const payload = {
    endereco: { codigoCidade: '123' },
    nfse: { ativo: true, config: { producao: true } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), false);
});

test('prefeitura string no config — no-op (não sobrescrever)', () => {
  const payload = {
    endereco: { codigoCidade: '3550308' },
    nfse: { ativo: true, config: { producao: true, prefeitura: 'x' } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), false);
  assert.equal(payload.nfse.config.prefeitura, 'x');
});

test('DP-PLOGIN-02 / FR-PREFB: derivação trilho B (só codigoIbge) inalterada — bloqueio BFF é política em empresa.service', () => {
  const payload = {
    endereco: { codigoCidade: '4106902' },
    nfse: { ativo: true, tipoContrato: 0, config: { producao: true } }
  };
  assert.equal(applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true }), true);
  assert.deepEqual(payload.nfse.config.prefeitura, { codigoIbge: '4106902' });
});

function hasPref(p) {
  return Boolean(p?.nfse?.config?.prefeitura);
}
