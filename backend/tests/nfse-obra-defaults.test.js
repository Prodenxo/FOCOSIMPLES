import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachNfseObraToServico,
  buildCidadePrestacaoFromObraEndereco,
  buildNfseObraPayload,
  enrichNfseCidadePrestacaoFromObra,
  requiresNfseObraForServicoCodigo,
  validateNfseObraEndereco,
} from '../src/services/nfse-obra-defaults.js';

test('requiresNfseObraForServicoCodigo — 070602 gesso exige obra', () => {
  assert.equal(requiresNfseObraForServicoCodigo('07.06.02'), true);
  assert.equal(requiresNfseObraForServicoCodigo('070602'), true);
  assert.equal(requiresNfseObraForServicoCodigo('140101'), false);
});

test('buildNfseObraPayload — PlugNotas só aceita art/codigo/cei (sem endereco)', () => {
  const obra = buildNfseObraPayload(
    {
      codigo: '070602',
      obra: {
        art: '123',
        cno: '456',
        cei: '789',
        usarEnderecoTomador: true,
        endereco: {
          cep: '14000000',
          logradouro: 'Rua A',
          numero: '10',
          bairro: 'Centro',
        },
      },
    },
    null,
  );
  assert.deepEqual(obra, { art: '123', codigo: '456', cei: '789' });
  assert.equal(obra?.endereco, undefined);
});

test('buildNfseObraPayload — endereço explícito não entra no grupo obra', () => {
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
  );
  assert.deepEqual(obra, {});
});

test('validateNfseObraEndereco — exige endereço completo com IBGE', () => {
  assert.match(
    validateNfseObraEndereco({ cep: '14000' }),
    /CEP da obra/,
  );
  assert.match(
    validateNfseObraEndereco({
      cep: '14000000',
      logradouro: 'Rua X',
      numero: '1',
      bairro: 'Centro',
    }),
    /município/,
  );
  assert.equal(
    validateNfseObraEndereco({
      cep: '14000000',
      logradouro: 'Rua X',
      numero: '1',
      bairro: 'Centro',
      codigoCidade: '3543402',
    }),
    null,
  );
});

test('buildCidadePrestacaoFromObraEndereco — monta raiz com endereço completo', () => {
  const cidade = buildCidadePrestacaoFromObraEndereco({
    codigoCidade: '3550308',
    descricaoCidade: 'São Paulo',
    estado: 'SP',
    cep: '01310100',
    logradouro: 'Av Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
  });
  assert.equal(cidade?.codigo, '3550308');
  assert.equal(cidade?.descricao, 'São Paulo');
  assert.equal(cidade?.estado, 'SP');
  assert.equal(cidade?.cep, '01310100');
  assert.equal(cidade?.logradouro, 'Av Paulista');
});

test('attachNfseObraToServico — ignora serviços fora da lista', () => {
  const servico = { codigo: '140101', discriminacao: 'Teste' };
  const next = attachNfseObraToServico(servico, servico, {});
  assert.equal(next.obra, undefined);
});

test('enrichNfseCidadePrestacaoFromObra — usa input da obra e endereço do tomador', () => {
  const out = enrichNfseCidadePrestacaoFromObra({
    servico: [{ codigo: '070602', obra: {} }],
    tomador: {
      endereco: {
        codigoCidade: '3550308',
        descricaoCidade: 'São Paulo',
        estado: 'SP',
        cep: '01310100',
        logradouro: 'Av Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
      },
    },
  }, {
    servicosInput: [{ codigo: '070602', obra: { usarEnderecoTomador: true } }],
  });
  assert.equal(out.cidadePrestacao?.codigo, '3550308');
  assert.equal(out.cidadePrestacao?.descricao, 'São Paulo');
  assert.equal(out.cidadePrestacao?.estado, 'SP');
  assert.equal(out.cidadePrestacao?.logradouro, 'Av Paulista');
  assert.equal(out.servico[0].obra?.endereco, undefined);
});
