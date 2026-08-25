import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLUGNOTAS_CRT_MEI,
  applyMeiNfeEmitForcePolicy,
  hydrateMeiNfeEmitenteIeFromEmpresa,
  ensureMeiNfePlugnotasCadastroBeforeEmit,
  configurePlugnotasNfeEmitPrepDeps,
  resetPlugnotasNfeEmitPrepDeps,
  isMeiNfeEmitForceEnabled,
} from '../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';

test('applyMeiNfeEmitForcePolicy força CRT 4 e regime MEI no emitente', () => {
  const prev = process.env.MEI_NFE_FORCE_CRT_EMIT;
  process.env.MEI_NFE_FORCE_CRT_EMIT = 'true';

  try {
    const input = {
      emitente: { cpfCnpj: '67146579000176' },
      config: { producao: true },
    };
    const out = applyMeiNfeEmitForcePolicy(input);

    if (!isMeiNfeEmitForceEnabled()) {
      assert.deepEqual(out, input);
      return;
    }

    assert.equal(out.crt, PLUGNOTAS_CRT_MEI);
    assert.equal(out.emitente.crt, PLUGNOTAS_CRT_MEI);
    assert.equal(out.emitente.regimeTributario, 1);
    assert.equal(out.emitente.regimeTributarioEspecial, 5);
    assert.equal(out.emitente.simplesNacional, true);
    assert.equal(out.config.versaoEsquema, 'pl_010c');
  } finally {
    if (prev === undefined) delete process.env.MEI_NFE_FORCE_CRT_EMIT;
    else process.env.MEI_NFE_FORCE_CRT_EMIT = prev;
  }
});

test('applyMeiNfeEmitForcePolicy preserva IE informada no emitente', () => {
  const out = applyMeiNfeEmitForcePolicy({
    emitente: {
      cpfCnpj: '67146579000176',
      inscricaoEstadual: '12345678901',
    },
  });
  assert.equal(out.emitente.inscricaoEstadual, '12345678901');
});

test('hydrateMeiNfeEmitenteIeFromEmpresa usa IE do cadastro quando payload vazio', () => {
  const out = hydrateMeiNfeEmitenteIeFromEmpresa(
    { emitente: { cpfCnpj: '67146579000176' } },
    { inscricaoEstadual: '987654321' },
  );
  assert.equal(out.emitente.inscricaoEstadual, '987654321');
});

test('hydrateMeiNfeEmitenteIeFromEmpresa ignora ISENTO', () => {
  const out = hydrateMeiNfeEmitenteIeFromEmpresa(
    { emitente: { cpfCnpj: '67146579000176' } },
    { inscricaoEstadual: 'ISENTO' },
  );
  assert.equal(out.emitente.inscricaoEstadual, undefined);
});

test('ensureMeiNfePlugnotasCadastroBeforeEmit activa NF-e quando cadastro só tinha NFS-e', async () => {
  const prevProduct = process.env.APP_PRODUCT;
  process.env.APP_PRODUCT = 'focosimples';

  const cnpj = '35774511000145';
  let patched = false;

  configurePlugnotasNfeEmitPrepDeps({
    consultarEmpresaPlugNotas: async () => ({
      nfse: { ativo: true },
      nfe: { ativo: patched },
      nfce: { ativo: false },
      certificado: 'cert-abc',
    }),
    resolverCertificadoIdPorCnpj: async () => 'cert-abc',
    vincularCertificadoEmpresaPlugNotas: async () => ({}),
    atualizarEmpresaPlugNotas: async (payload) => {
      assert.equal(payload.documentosAtivos?.nfe, true);
      patched = true;
      return { cnpj: payload.cpfCnpj };
    },
  });

  try {
    const out = await ensureMeiNfePlugnotasCadastroBeforeEmit(cnpj);
    assert.equal(patched, true);
    assert.equal(out?.nfe?.ativo, true);
  } finally {
    resetPlugnotasNfeEmitPrepDeps();
    if (prevProduct === undefined) delete process.env.APP_PRODUCT;
    else process.env.APP_PRODUCT = prevProduct;
  }
});
