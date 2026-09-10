import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichNfseIssInEmitPayload,
  mergeNfseServicoIssInput,
  readNfseNacionalFromEmpresa,
  resolveDefaultTipoTributacao,
  resolveNfseIssAliquota,
  resolveNfseIssForServico,
  shouldOmitNfseIssAliquota,
} from '../src/services/nfse-iss-defaults.js';

test('resolveNfseIssForServico: defaults Simples municipal (tipo 1 + alíquota 2)', () => {
  const iss = resolveNfseIssForServico({}, { simplesNacional: true, nfseNacional: false });
  assert.deepEqual(iss, {
    tipoTributacao: 1,
    exigibilidade: 1,
    retido: false,
    aliquota: 2,
  });
});

test('resolveNfseIssForServico: ISSNETONLINE30 Simples (tipo 6 + alíquota 2)', () => {
  const iss = resolveNfseIssForServico({}, {
    simplesNacional: true,
    nfseNacional: false,
    issnetOnline30: true,
  });
  assert.equal(iss.tipoTributacao, 6);
  assert.equal(iss.aliquota, 2);
});

test('resolveNfseIssForServico: Simples nacional sem retenção omite alíquota (E0625)', () => {
  const iss = resolveNfseIssForServico({}, { simplesNacional: true, nfseNacional: true });
  assert.equal(iss.tipoTributacao, 6);
  assert.equal(iss.exigibilidade, 1);
  assert.equal(iss.retido, false);
  assert.equal(iss.aliquota, undefined);
  assert.equal(shouldOmitNfseIssAliquota({ nfseNacional: true, simplesNacional: true }, {}), true);
});

test('resolveNfseIssForServico: Simples nacional com ISS retido mantém alíquota', () => {
  const iss = resolveNfseIssForServico(
    { retido: true, aliquota: 5 },
    { simplesNacional: true, nfseNacional: true },
  );
  assert.equal(iss.retido, true);
  assert.equal(iss.aliquota, 5);
});

test('resolveNfseIssForServico: nacional Simples ignora alíquota explícita sem retenção (E0625)', () => {
  const iss = resolveNfseIssForServico(
    { aliquota: 2 },
    { simplesNacional: true, nfseNacional: true },
  );
  assert.equal(iss.aliquota, undefined);
});

test('resolveNfseIssForServico: preserva iss explícito e alíquota informada', () => {
  const iss = resolveNfseIssForServico(
    { tipoTributacao: 4, exigibilidade: 2, retido: true, aliquota: 5 },
    { simplesNacional: true, nfseNacional: false },
  );
  assert.equal(iss.tipoTributacao, 4);
  assert.equal(iss.exigibilidade, 2);
  assert.equal(iss.retido, true);
  assert.equal(iss.aliquota, 5);
});

test('mergeNfseServicoIssInput: copia aliquota do serviço para iss', () => {
  const iss = mergeNfseServicoIssInput({ aliquota: 3.5, iss: { retido: true } });
  assert.equal(iss.aliquota, 3.5);
  assert.equal(iss.retido, true);
});

test('enrichNfseIssInEmitPayload: preenche iss.aliquota em todos os serviços', () => {
  const out = enrichNfseIssInEmitPayload(
    { servico: [{ codigo: '140101' }, { codigo: '140102', aliquota: 4 }] },
    { nfseNacional: false, simplesNacional: true },
  );
  assert.equal(out.servico[0].iss.aliquota, 2);
  assert.equal(out.servico[1].iss.aliquota, 4);
  assert.equal(out.servico[1].iss.tipoTributacao, 1);
});

test('readNfseNacionalFromEmpresa: false quando config desliga nacional', () => {
  assert.equal(
    readNfseNacionalFromEmpresa({ nfse: { config: { nfseNacional: false } } }),
    false,
  );
  assert.equal(readNfseNacionalFromEmpresa({ nfse: { config: {} } }), true);
});

test('resolveDefaultTipoTributacao e resolveNfseIssAliquota', () => {
  assert.equal(resolveDefaultTipoTributacao({ nfseNacional: false }), 1);
  assert.equal(resolveDefaultTipoTributacao({ nfseNacional: true }), 6);
  assert.equal(resolveDefaultTipoTributacao({ nfseNacional: false, issnetOnline30: true }), 6);
  assert.equal(resolveNfseIssAliquota({}, { nfseNacional: false }), 2);
  assert.equal(resolveNfseIssAliquota({ aliquota: 0 }, { nfseNacional: false }), 0);
  assert.equal(resolveNfseIssAliquota({}, { nfseNacional: true, simplesNacional: true }), null);
});

test('enrichNfseIssInEmitPayload: nacional Simples remove aliquota do serviço e do iss', () => {
  const out = enrichNfseIssInEmitPayload(
    { servico: [{ codigo: '140101', aliquota: 2 }] },
    { nfseNacional: true, simplesNacional: true },
  );
  assert.equal(out.servico[0].aliquota, undefined);
  assert.equal(out.servico[0].iss.aliquota, undefined);
});
