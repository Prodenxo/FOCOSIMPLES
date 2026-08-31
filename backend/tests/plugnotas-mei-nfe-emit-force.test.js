import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLUGNOTAS_CRT_MEI,
  applyMeiNfeEmitForcePolicy,
  applyNfeCrtAndSchemaForEmit,
  hydrateMeiNfeEmitenteIeFromEmpresa,
  ensureMeiNfePlugnotasCadastroBeforeEmit,
  configurePlugnotasNfeEmitPrepDeps,
  resetPlugnotasNfeEmitPrepDeps,
  isMeiNfeEmitForceEnabled,
  resolvePlugnotasNfeCrt,
} from '../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';

test('resolvePlugnotasNfeCrt usa CRT 4 para MEI e CRT 1 com IE real', () => {
  assert.equal(resolvePlugnotasNfeCrt({
    empresa: { regimeTributarioEspecial: 5 },
  }), 4);
  assert.equal(resolvePlugnotasNfeCrt({
    empresa: { inscricaoEstadual: 'ISENTO' },
  }), 4);
  assert.equal(resolvePlugnotasNfeCrt({
    empresa: { inscricaoEstadual: '123456789' },
    emitente: { crt: 1 },
  }), 1);
});

test('applyNfeCrtAndSchemaForEmit preenche CRT e esquema MEI', () => {
  const out = applyNfeCrtAndSchemaForEmit(
    { emitente: { cpfCnpj: '35774511000145' }, config: { producao: true } },
    { regimeTributarioEspecial: 5 },
  );
  assert.equal(out.crt, 4);
  assert.equal(out.emitente.crt, 4);
  assert.equal(out.config.versaoEsquema, 'pl_010c');
  assert.equal(out.config.producao, true);
});

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
      if (payload.documentosAtivos?.nfe === true) patched = true;
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

test('ensureMeiNfePlugnotasCadastroBeforeEmit no Foco Simples aplica pl_010c se for MEI', async () => {
  const prevProduct = process.env.APP_PRODUCT;
  process.env.APP_PRODUCT = 'focosimples';

  let schemaPatch = null;
  configurePlugnotasNfeEmitPrepDeps({
    consultarEmpresaPlugNotas: async () => ({
      regimeTributarioEspecial: 5,
      inscricaoEstadual: 'ISENTO',
      certificado: 'cert-abc',
      nfe: { ativo: true, config: { versaoEsquema: 'pl_009' } },
    }),
    resolverCertificadoIdPorCnpj: async () => 'cert-abc',
    vincularCertificadoEmpresaPlugNotas: async () => ({}),
    atualizarEmpresaPlugNotas: async (payload) => {
      schemaPatch = payload;
      return { cnpj: payload.cpfCnpj };
    },
  });

  try {
    await ensureMeiNfePlugnotasCadastroBeforeEmit('35774511000145');
    assert.equal(schemaPatch?.nfe?.config?.versaoEsquema, 'pl_010c');
    assert.equal(schemaPatch?.regimeTributarioEspecial, undefined);
  } finally {
    resetPlugnotasNfeEmitPrepDeps();
    if (prevProduct === undefined) delete process.env.APP_PRODUCT;
    else process.env.APP_PRODUCT = prevProduct;
  }
});
