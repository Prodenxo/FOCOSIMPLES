import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNfeResponsavelTecnicoFromEnv,
  PLUGNOTAS_RESPONSAVEL_TECNICO_DEFAULT,
  resolveNfeResponsavelTecnicoForPlugnotas,
} from '../src/lib/nfe-responsavel-tecnico.js';
import { normalizePlugnotasNfePayload } from '../src/services/plugnotas/plugnotas-nfe-payload.js';

test('resolveNfeResponsavelTecnicoForPlugnotas usa bloco completo do payload', () => {
  const block = {
    cpfCnpj: '17422651000172',
    nome: 'CF RJ CONTABILIDADE LTDA',
    email: 'contato@empresa.com.br',
    telefone: { ddd: '21', numero: '999999999' },
  };
  assert.deepEqual(resolveNfeResponsavelTecnicoForPlugnotas(block), block);
});

test('resolveNfeResponsavelTecnicoForPlugnotas cai no padrão PlugNotas sem env', () => {
  const prev = {
    NFE_RESPONSAVEL_TECNICO_CNPJ: process.env.NFE_RESPONSAVEL_TECNICO_CNPJ,
    NFE_RESPONSAVEL_TECNICO_NOME: process.env.NFE_RESPONSAVEL_TECNICO_NOME,
    NFE_RESPONSAVEL_TECNICO_EMAIL: process.env.NFE_RESPONSAVEL_TECNICO_EMAIL,
    NFE_RESPONSAVEL_TECNICO_DDD: process.env.NFE_RESPONSAVEL_TECNICO_DDD,
    NFE_RESPONSAVEL_TECNICO_TELEFONE: process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE,
  };
  delete process.env.NFE_RESPONSAVEL_TECNICO_CNPJ;
  delete process.env.NFE_RESPONSAVEL_TECNICO_NOME;
  delete process.env.NFE_RESPONSAVEL_TECNICO_EMAIL;
  delete process.env.NFE_RESPONSAVEL_TECNICO_DDD;
  delete process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE;

  assert.deepEqual(
    resolveNfeResponsavelTecnicoForPlugnotas(undefined),
    PLUGNOTAS_RESPONSAVEL_TECNICO_DEFAULT,
  );

  Object.assign(process.env, prev);
});

test('buildNfeResponsavelTecnicoFromEnv reutiliza SERPRO_CONTRATANTE para CNPJ e nome', () => {
  const prev = {
    NFE_RESPONSAVEL_TECNICO_CNPJ: process.env.NFE_RESPONSAVEL_TECNICO_CNPJ,
    NFE_RESPONSAVEL_TECNICO_NOME: process.env.NFE_RESPONSAVEL_TECNICO_NOME,
    NFE_RESPONSAVEL_TECNICO_EMAIL: process.env.NFE_RESPONSAVEL_TECNICO_EMAIL,
    NFE_RESPONSAVEL_TECNICO_DDD: process.env.NFE_RESPONSAVEL_TECNICO_DDD,
    NFE_RESPONSAVEL_TECNICO_TELEFONE: process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE,
    SERPRO_CONTRATANTE_NUMERO: process.env.SERPRO_CONTRATANTE_NUMERO,
    SERPRO_CONTRATANTE_NOME: process.env.SERPRO_CONTRATANTE_NOME,
  };

  delete process.env.NFE_RESPONSAVEL_TECNICO_CNPJ;
  delete process.env.NFE_RESPONSAVEL_TECNICO_NOME;
  process.env.SERPRO_CONTRATANTE_NUMERO = '17422651000172';
  process.env.SERPRO_CONTRATANTE_NOME = 'CF RJ CONTABILIDADE LTDA';
  process.env.NFE_RESPONSAVEL_TECNICO_EMAIL = 'contato@cf.com.br';
  process.env.NFE_RESPONSAVEL_TECNICO_DDD = '21';
  process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE = '988887777';

  assert.deepEqual(buildNfeResponsavelTecnicoFromEnv(), {
    cpfCnpj: '17422651000172',
    nome: 'CF RJ CONTABILIDADE LTDA',
    email: 'contato@cf.com.br',
    telefone: { ddd: '21', numero: '988887777' },
  });

  Object.assign(process.env, prev);
});

test('buildNfeResponsavelTecnicoFromEnv monta bloco a partir das vars NFE', () => {
  const prev = {
    NFE_RESPONSAVEL_TECNICO_CNPJ: process.env.NFE_RESPONSAVEL_TECNICO_CNPJ,
    NFE_RESPONSAVEL_TECNICO_NOME: process.env.NFE_RESPONSAVEL_TECNICO_NOME,
    NFE_RESPONSAVEL_TECNICO_EMAIL: process.env.NFE_RESPONSAVEL_TECNICO_EMAIL,
    NFE_RESPONSAVEL_TECNICO_DDD: process.env.NFE_RESPONSAVEL_TECNICO_DDD,
    NFE_RESPONSAVEL_TECNICO_TELEFONE: process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE,
  };

  process.env.NFE_RESPONSAVEL_TECNICO_CNPJ = '17.422.651/0001-72';
  process.env.NFE_RESPONSAVEL_TECNICO_NOME = 'CF RJ CONTABILIDADE LTDA';
  process.env.NFE_RESPONSAVEL_TECNICO_EMAIL = 'contato@cf.com.br';
  process.env.NFE_RESPONSAVEL_TECNICO_DDD = '21';
  process.env.NFE_RESPONSAVEL_TECNICO_TELEFONE = '988887777';

  assert.deepEqual(buildNfeResponsavelTecnicoFromEnv(), {
    cpfCnpj: '17422651000172',
    nome: 'CF RJ CONTABILIDADE LTDA',
    email: 'contato@cf.com.br',
    telefone: { ddd: '21', numero: '988887777' },
  });

  Object.assign(process.env, prev);
});

test('normalizePlugnotasNfePayload inclui responsavelTecnico', () => {
  const out = normalizePlugnotasNfePayload({
    emitente: { cpfCnpj: '49453916000196' },
    itens: [],
  });

  assert.ok(out.responsavelTecnico);
  assert.equal(out.responsavelTecnico.cpfCnpj, PLUGNOTAS_RESPONSAVEL_TECNICO_DEFAULT.cpfCnpj);
  assert.ok(out.responsavelTecnico.telefone?.ddd);
});
