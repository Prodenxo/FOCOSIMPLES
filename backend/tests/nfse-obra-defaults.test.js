import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachNfseObraToServico,
  buildCidadePrestacaoFromObraEndereco,
  buildNfseObraPayload,
  enrichNfseCidadePrestacaoFromObra,
  enrichNfseObraOnEmitPayload,
  NFSE_OBRA_CODIGO_SEM_CADASTRO,
  requiresNfseObraForServicoCodigo,
  resolveNfseObraCodigoForEmit,
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
  assert.deepEqual(obra, { codigo: '456', art: '123', cei: '789' });
  assert.equal(obra?.endereco, undefined);
});

test('buildNfseObraPayload — sem CNO usa codigo mínimo para E0370', () => {
  const obra = buildNfseObraPayload(
    {
      codigo: '070602',
      obra: { usarEnderecoTomador: true },
    },
    null,
  );
  assert.deepEqual(obra, { codigo: NFSE_OBRA_CODIGO_SEM_CADASTRO });
});

test('resolveNfseObraCodigoForEmit — prioriza CNO/código informado', () => {
  assert.equal(resolveNfseObraCodigoForEmit({ cno: '999' }), '999');
  assert.equal(resolveNfseObraCodigoForEmit({}), NFSE_OBRA_CODIGO_SEM_CADASTRO);
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

test('enrichNfseObraOnEmitPayload — anexa grupo obra após prune simulado', () => {
  const out = enrichNfseObraOnEmitPayload({
    servico: [{ codigo: '070602', discriminacao: 'Gesso' }],
    tomador: {
      endereco: {
        codigoCidade: '3543402',
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
      },
    },
  }, {
    servicosInput: [{ codigo: '070602', obra: { usarEnderecoTomador: true } }],
  });
  assert.equal(out.servico[0].obra?.codigo, NFSE_OBRA_CODIGO_SEM_CADASTRO);
  assert.equal(out.servico[0].obra?.endereco, undefined);
  assert.equal(out.servico[0].codigoCidadeIncidencia, '3543402');
});

test('enrichNfseCidadePrestacaoFromObra — usa input da obra e endereço do tomador', () => {
  const out = enrichNfseCidadePrestacaoFromObra({
    servico: [{ codigo: '070602' }],
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
});
