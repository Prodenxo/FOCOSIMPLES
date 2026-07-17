import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNfsePrestadorEmailOrThrow,
  enderecoFromCnpjLookupNfse,
  enrichNfseEmitPayloadEmails,
  hasCompleteTomadorEndereco,
  isValidPlugnotasEmitEmail,
  normalizeTomadorEnderecoFromEmitPayload,
  pickFirstValidEmitEmail,
} from '../src/services/plugnotas/plugnotas-nfse-email-resolve.js';

test('pickFirstValidEmitEmail ignora valores inválidos', () => {
  assert.equal(pickFirstValidEmitEmail('', null, 'foo', 'a@b.com'), 'a@b.com');
  assert.equal(pickFirstValidEmitEmail('invalid'), null);
});

test('isValidPlugnotasEmitEmail valida formato básico', () => {
  assert.equal(isValidPlugnotasEmitEmail('contato@empresa.com.br'), true);
  assert.equal(isValidPlugnotasEmitEmail('sem-arroba'), false);
});

test('enrichNfseEmitPayloadEmails preserva e-mail já informado no payload', async () => {
  const payload = await enrichNfseEmitPayloadEmails(
    'user-1',
    {
      prestador: { cpfCnpj: '65599761000157', email: 'prestador@mei.com' },
      tomador: { cpfCnpj: '12345678901', email: 'tomador@cliente.com' },
    },
    {
      prestadorDoc: '65599761000157',
      tomadorDoc: '12345678901',
    },
  );

  assert.equal(payload.prestador.email, 'prestador@mei.com');
  assert.equal(payload.tomador.email, 'tomador@cliente.com');
});

test('hasCompleteTomadorEndereco valida endereço mínimo', () => {
  assert.equal(hasCompleteTomadorEndereco(null), false);
  assert.equal(
    hasCompleteTomadorEndereco({
      cep: '01310100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
    }),
    true,
  );
});

test('enderecoFromCnpjLookupNfse usa S/N quando número ausente', () => {
  const endereco = enderecoFromCnpjLookupNfse({
    endereco: {
      cep: '59082000',
      logradouro: 'Rua Teste',
      bairro: 'Centro',
      codigoCidade: '2408102',
      descricaoCidade: 'Natal',
      estado: 'RN',
    },
  });
  assert.equal(endereco?.numero, 'S/N');
  assert.equal(hasCompleteTomadorEndereco(endereco), true);
});

test('normalizeTomadorEnderecoFromEmitPayload lê tomadorCep plano do OpenClaw', () => {
  const endereco = normalizeTomadorEnderecoFromEmitPayload({
    tomadorCep: '21635001',
    tomadorLogradouro: 'Rua A',
    tomadorNumero: '100',
    tomadorBairro: 'Centro',
    tomadorCodigoCidade: '3304557',
    tomadorCidade: 'Rio de Janeiro',
    tomadorUf: 'RJ',
  });
  assert.equal(endereco?.cep, '21635001');
  assert.equal(hasCompleteTomadorEndereco(endereco), true);
});

test('normalizeTomadorEnderecoFromEmitPayload prioriza tomadorEndereco aninhado', () => {
  const endereco = normalizeTomadorEnderecoFromEmitPayload({
    tomadorCep: '00000000',
    tomadorEndereco: {
      cep: '21635001',
      logradouro: 'Rua B',
      numero: '50',
      bairro: 'Bangu',
      codigoCidade: '3304557',
      descricaoCidade: 'Rio de Janeiro',
      estado: 'RJ',
    },
  });
  assert.equal(endereco?.cep, '21635001');
  assert.equal(endereco?.logradouro, 'Rua B');
});

test('assertNfsePrestadorEmailOrThrow exige e-mail do prestador', () => {
  assert.throws(
    () => assertNfsePrestadorEmailOrThrow({ prestador: { cpfCnpj: '65599761000157' } }),
    /E-mail do prestador é obrigatório/,
  );
  assert.doesNotThrow(() => assertNfsePrestadorEmailOrThrow({
    prestador: { cpfCnpj: '65599761000157', email: 'a@b.com' },
  }));
});
