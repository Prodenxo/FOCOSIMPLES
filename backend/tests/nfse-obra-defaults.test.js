import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachNfseObraToServico,
  buildNfseObraPayload,
  requiresNfseObraForServicoCodigo,
  validateNfseObraPayload,
} from '../src/services/nfse-obra-defaults.js';

test('requiresNfseObraForServicoCodigo — 070602 gesso exige obra', () => {
  assert.equal(requiresNfseObraForServicoCodigo('07.06.02'), true);
  assert.equal(requiresNfseObraForServicoCodigo('070602'), true);
  assert.equal(requiresNfseObraForServicoCodigo('140101'), false);
});

test('buildNfseObraPayload — usa endereço do tomador por padrão', () => {
  const obra = buildNfseObraPayload(
    { codigo: '070602', obra: { usarEnderecoTomador: true } },
    null,
    {
      cep: '14000000',
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      codigoCidade: '3543402',
      estado: 'SP',
    },
  );
  assert.ok(obra?.endereco);
  assert.equal(obra.endereco.cep, '14000000');
  assert.equal(obra.endereco.logradouro, 'Rua A');
});

test('buildNfseObraPayload — endereço explícito quando obra em outro local', () => {
  const obra = buildNfseObraPayload(
    {
      codigo: '070602',
      obra: {
        usarEnderecoTomador: false,
        endereco: {
          cep: '01310-100',
          logradouro: 'Av Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
        },
      },
    },
    null,
    { cep: '14000000', logradouro: 'Rua Tomador', numero: '1', bairro: 'Centro' },
  );
  assert.equal(obra?.endereco?.logradouro, 'Av Paulista');
  assert.equal(obra?.endereco?.cep, '01310100');
});

test('validateNfseObraPayload — exige endereço completo', () => {
  assert.match(
    validateNfseObraPayload({ endereco: { cep: '14000' } }),
    /CEP da obra/,
  );
  assert.equal(
    validateNfseObraPayload({
      endereco: {
        cep: '14000000',
        logradouro: 'Rua X',
        numero: '1',
        bairro: 'Centro',
      },
    }),
    null,
  );
});

test('attachNfseObraToServico — ignora serviços fora da lista', () => {
  const servico = { codigo: '140101', discriminacao: 'Teste' };
  const next = attachNfseObraToServico(servico, servico, {}, null);
  assert.equal(next.obra, undefined);
});
