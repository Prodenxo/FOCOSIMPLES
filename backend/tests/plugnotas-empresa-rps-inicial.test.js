import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEmpresaPlugnotasNfseConfigRps,
  applyEmpresaPlugnotasRpsInicialForPost,
  EMPRESA_PLUGNOTAS_RPS_INICIAL_POST,
  hasNfseConfigRpsShape,
  sanitizeEmpresaPlugnotasRpsPayload,
  stripRpsFromEmpresaPayload
} from '../src/services/plugnotas/plugnotas-empresa-rps-inicial.js';

test('applyEmpresaPlugnotasRpsInicialForPost é idempotente e canónico', () => {
  const payload = { x: 1, nfse: { ativo: true, tipoContrato: 0, config: { producao: true } } };
  applyEmpresaPlugnotasRpsInicialForPost(payload);
  assert.deepEqual(payload.rps, {
    lote: EMPRESA_PLUGNOTAS_RPS_INICIAL_POST.lote,
    numeracao: [{ numero: 1, serie: '1' }]
  });
  assert.deepEqual(payload.nfse.config.rps, { serie: '1', numero: 1, lote: 1 });
  applyEmpresaPlugnotasRpsInicialForPost(payload);
  assert.deepEqual(payload.rps, {
    lote: 1,
    numeracao: [{ numero: 1, serie: '1' }]
  });
});

test('hasNfseConfigRpsShape valida nfse.config.rps', () => {
  assert.equal(
    hasNfseConfigRpsShape({
      nfse: { ativo: true, config: { rps: { serie: '1', numero: 1, lote: 1 } } }
    }),
    true
  );
  assert.equal(
    hasNfseConfigRpsShape({
      nfse: { ativo: true, config: { rps: { lote: 1, numeracao: [{ serie: '1', numero: 4 }] } } }
    }),
    true
  );
  assert.equal(
    hasNfseConfigRpsShape({ nfse: { ativo: true, config: { rps: { lote: 1 } } } }),
    false
  );
});

test('applyEmpresaPlugnotasNfseConfigRps preenche config.rps quando NFS-e activa', () => {
  const payload = { nfse: { ativo: true, tipoContrato: 0, config: { producao: true } } };
  applyEmpresaPlugnotasNfseConfigRps(payload);
  assert.deepEqual(payload.nfse.config.rps, { serie: '1', numero: 1, lote: 1 });
});

test('applyEmpresaPlugnotasRpsInicialForPost sanitiza e preserva rps válido do cliente', () => {
  const payload = {
    rps: { lote: 99, numeracao: [{ numero: 5, serie: 'Z' }] }
  };
  applyEmpresaPlugnotasRpsInicialForPost(payload);
  assert.equal(payload.rps.lote, 99);
  assert.equal(payload.rps.numeracao[0].numero, 5);
  assert.equal(payload.rps.numeracao[0].serie, 'Z');
});

test('applyEmpresaPlugnotasRpsInicialForPost aplica canónico quando rps não tem shape utilizável', () => {
  const payload = { rps: { lote: 1 } };
  applyEmpresaPlugnotasRpsInicialForPost(payload);
  assert.deepEqual(payload.rps, {
    lote: EMPRESA_PLUGNOTAS_RPS_INICIAL_POST.lote,
    numeracao: [{ numero: 1, serie: '1' }]
  });
});

test('sanitizeEmpresaPlugnotasRpsPayload remove rps inválido', () => {
  const payload = { rps: { lote: 1 } };
  sanitizeEmpresaPlugnotasRpsPayload(payload);
  assert.equal('rps' in payload, false);
});

test('applyEmpresaPlugnotasRpsInicialForPost ignora não-objectos', () => {
  applyEmpresaPlugnotasRpsInicialForPost(null);
  applyEmpresaPlugnotasRpsInicialForPost(undefined);
  applyEmpresaPlugnotasRpsInicialForPost([]);
});

test('stripRpsFromEmpresaPayload remove rps e devolve o mesmo objecto', () => {
  const payload = { a: 1, rps: { lote: 1 } };
  const out = stripRpsFromEmpresaPayload(payload);
  assert.strictEqual(out, payload);
  assert.equal('rps' in payload, false);
});

test('stripRpsFromEmpresaPayload sem rps é no-op', () => {
  const payload = { a: 1 };
  stripRpsFromEmpresaPayload(payload);
  assert.deepEqual(payload, { a: 1 });
});
