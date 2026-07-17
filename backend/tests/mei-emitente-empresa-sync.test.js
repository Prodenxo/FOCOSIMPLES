import test from 'node:test';
import assert from 'node:assert/strict';
import {
  empresaJsonToEmitentePartial,
  mergeEmitenteWithEmpresaPartial,
  unwrapPlugnotasEmpresaRecord,
} from '../src/services/mei-emitente-empresa-sync.js';

test('empresaJsonToEmitentePartial extrai IBGE e endereço do JSON Plugnotas', () => {
  const partial = empresaJsonToEmitentePartial({
    cpfCnpj: '65805583000173',
    razaoSocial: 'YASMIM DUQUE',
    email: 'yasmim@example.com',
    endereco: {
      tipoLogradouro: 'Rua',
      logradouro: 'Oliveira Belo',
      numero: '441',
      bairro: 'VILA DA PENHA',
      codigoCidade: '3304557',
      descricaoCidade: 'RIO DE JANEIRO',
      estado: 'RJ',
      cep: '21221300',
    },
  });

  assert.equal(partial?.codigoCidade, '3304557');
  assert.equal(partial?.logradouro, 'Oliveira Belo');
  assert.equal(partial?.numero, '441');
  assert.equal(partial?.cep, '21221300');
  assert.equal(partial?.descricaoCidade, 'RIO DE JANEIRO');
  assert.equal(partial?.estado, 'RJ');
});

test('empresaJsonToEmitentePartial retorna null sem endereco', () => {
  assert.equal(empresaJsonToEmitentePartial({ razaoSocial: 'X' }), null);
});

test('empresaJsonToEmitentePartial desembrulha GET Plugnotas { data: { ... } }', () => {
  const partial = empresaJsonToEmitentePartial({
    message: 'OK',
    data: {
      cpfCnpj: '65805583000173',
      razaoSocial: 'YASMIM',
      endereco: {
        logradouro: 'Oliveira Belo',
        numero: '441',
        codigoCidade: '3304557',
        cep: '21221300',
        estado: 'RJ',
        descricaoCidade: 'RIO DE JANEIRO',
      },
    },
  });
  assert.equal(partial?.codigoCidade, '3304557');
  assert.equal(unwrapPlugnotasEmpresaRecord({ data: { cpfCnpj: '1' } })?.cpfCnpj, '1');
});

test('empresaJsonToEmitentePartial aceita endereco plano no root da empresa', () => {
  const partial = empresaJsonToEmitentePartial({
    message: 'OK',
    data: {
      cpfCnpj: '65805583000173',
      razaoSocial: 'YASMIM',
      logradouro: 'Oliveira Belo',
      numero: '441',
      codigoCidade: '3304557',
      cep: '21221300',
      estado: 'RJ',
      descricaoCidade: 'RIO DE JANEIRO',
    },
  });
  assert.equal(partial?.codigoCidade, '3304557');
  assert.equal(partial?.logradouro, 'Oliveira Belo');
});

test('empresaJsonToEmitentePartial desembrulha data como array', () => {
  const partial = empresaJsonToEmitentePartial({
    data: [
      { id: 'x' },
      {
        cpfCnpj: '65805583000173',
        endereco: {
          logradouro: 'Rua B',
          numero: '10',
          codigoCidade: '3304557',
          cep: '21221300',
        },
      },
    ],
  });
  assert.equal(partial?.logradouro, 'Rua B');
  assert.equal(partial?.codigoCidade, '3304557');
});

test('empresaJsonToEmitentePartial aceita payload BrasilAPI (lookup CNPJ)', () => {
  const partial = empresaJsonToEmitentePartial({
    cpfCnpj: '65805583000173',
    razaoSocial: 'YASMIM DUQUE',
    endereco: {
      logradouro: 'RUA OLIVEIRA BELO',
      numero: '441',
      bairro: 'VILA DA PENHA',
      codigoCidade: '3304557',
      descricaoCidade: 'RIO DE JANEIRO',
      estado: 'RJ',
      cep: '21221300',
    },
  });
  assert.equal(partial?.codigoCidade, '3304557');
  assert.equal(partial?.razaoSocial, 'YASMIM DUQUE');
});

test('mergeEmitenteWithEmpresaPartial preenche IBGE sem apagar certDocument', () => {
  const partial = empresaJsonToEmitentePartial({
    razaoSocial: 'YASMIM',
    endereco: {
      logradouro: 'Oliveira Belo',
      numero: '441',
      codigoCidade: '3304557',
      cep: '21221300',
      estado: 'RJ',
      descricaoCidade: 'RIO DE JANEIRO',
    },
  });
  const merged = mergeEmitenteWithEmpresaPartial(
    { certDocument: '65805583000173', codigoCidade: '' },
    partial,
  );
  assert.equal(merged?.certDocument, '65805583000173');
  assert.equal(merged?.codigoCidade, '3304557');
  assert.equal(merged?.logradouro, 'Oliveira Belo');
});
