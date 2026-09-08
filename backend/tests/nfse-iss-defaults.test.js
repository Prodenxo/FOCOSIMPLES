import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichNfseIssInEmitPayload,
  readNfseNacionalFromEmpresa,
  resolveDefaultTipoTributacao,
  resolveNfseIssForServico,
} from '../src/services/nfse-iss-defaults.js';

test('resolveNfseIssForServico: defaults Simples municipal (tipo 1, sem alíquota)', () => {
  const iss = resolveNfseIssForServico({}, { simplesNacional: true, nfseNacional: false });
  assert.deepEqual(iss, {
    tipoTributacao: 1,
    exigibilidade: 1,
    retido: false,
  });
});

test('resolveNfseIssForServico: defaults Simples nacional (tipo 6)', () => {
  const iss = resolveNfseIssForServico({}, { simplesNacional: true, nfseNacional: true });
  assert.equal(iss.tipoTributacao, 6);
  assert.equal(iss.exigibilidade, 1);
  assert.equal(iss.retido, false);
  assert.equal(iss.aliquota, undefined);
});

test('resolveNfseIssForServico: preserva iss explícito e ignora alíquota no Simples', () => {
  const iss = resolveNfseIssForServico(
    { tipoTributacao: 4, exigibilidade: 2, retido: true, aliquota: 5 },
    { simplesNacional: true, nfseNacional: false },
  );
  assert.equal(iss.tipoTributacao, 4);
  assert.equal(iss.exigibilidade, 2);
  assert.equal(iss.retido, true);
  assert.equal(iss.aliquota, undefined);
});

test('resolveNfseIssForServico: não-Simples pode enviar alíquota', () => {
  const iss = resolveNfseIssForServico(
    { aliquota: 3 },
    { simplesNacional: false, nfseNacional: false },
  );
  assert.equal(iss.aliquota, 3);
  assert.equal(iss.tipoTributacao, 1);
});

test('enrichNfseIssInEmitPayload: preenche iss em todos os serviços', () => {
  const out = enrichNfseIssInEmitPayload(
    { servico: [{ codigo: '140101' }, { codigo: '140102', iss: { retido: true } }] },
    { nfseNacional: false, simplesNacional: true },
  );
  assert.equal(out.servico[0].iss.tipoTributacao, 1);
  assert.equal(out.servico[1].iss.tipoTributacao, 1);
  assert.equal(out.servico[1].iss.retido, true);
});

test('readNfseNacionalFromEmpresa: false quando config desliga nacional', () => {
  assert.equal(
    readNfseNacionalFromEmpresa({ nfse: { config: { nfseNacional: false } } }),
    false,
  );
  assert.equal(readNfseNacionalFromEmpresa({ nfse: { config: {} } }), true);
});

test('resolveDefaultTipoTributacao', () => {
  assert.equal(resolveDefaultTipoTributacao({ nfseNacional: false }), 1);
  assert.equal(resolveDefaultTipoTributacao({ nfseNacional: true }), 6);
  assert.equal(resolveDefaultTipoTributacao({ simplesNacional: false }), 1);
});
