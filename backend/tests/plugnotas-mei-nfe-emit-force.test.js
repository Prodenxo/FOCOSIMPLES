import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLUGNOTAS_CRT_MEI,
  applyMeiNfeEmitForcePolicy,
  hydrateMeiNfeEmitenteIeFromEmpresa,
} from '../src/services/plugnotas/plugnotas-mei-nfe-emit-force.js';

test('applyMeiNfeEmitForcePolicy força CRT 4 e regime MEI no emitente', () => {
  const prev = process.env.MEI_NFE_FORCE_CRT_EMIT;
  process.env.MEI_NFE_FORCE_CRT_EMIT = 'true';

  try {
    const out = applyMeiNfeEmitForcePolicy({
      emitente: { cpfCnpj: '67146579000176' },
      config: { producao: true },
    });

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
