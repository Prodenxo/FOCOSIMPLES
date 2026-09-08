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
  stripCidadePrestacaoForIssnetRtcObra,
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
  assert.equal(cidade?.tipoLogradouro, 'Rua');
  assert.equal(cidade?.tipoBairro, 'Bairro');
});

test('buildCidadePrestacaoFromObraEndereco — preserva tipoLogradouro informado', () => {
  const cidade = buildCidadePrestacaoFromObraEndereco({
    codigoCidade: '3543402',
    logradouro: 'Rua A',
    bairro: 'Centro',
    tipoLogradouro: 'Avenida',
    tipoBairro: 'Jardim',
  });
  assert.equal(cidade?.tipoLogradouro, 'Avenida');
  assert.equal(cidade?.tipoBairro, 'Jardim');
});

test('attachNfseObraToServico — ignora serviços fora da lista', () => {
  const servico = { codigo: '140101', discriminacao: 'Teste' };
  const next = attachNfseObraToServico(servico, servico, {});
  assert.equal(next.obra, undefined);
});

test('buildNfseObraPayload — ISSNET RTC: endereço plano, sem codigo placeholder', () => {
  const obra = buildNfseObraPayload(
    {
      codigo: '070602',
      obra: { usarEnderecoTomador: true },
    },
    null,
    {
      issnetOnline30: true,
      obraEndereco: {
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        codigoCidade: '3543402',
        estado: 'SP',
      },
    },
  );
  assert.equal(obra?.codigo, undefined);
  assert.equal(obra?.cep, '14000000');
  assert.equal(obra?.logradouro, 'Rua A');
  assert.equal(obra?.bairro, 'Centro');
  assert.equal(obra?.codigoCidade, '3543402');
});

test('buildNfseObraPayload — ISSNET RTC: CNO real informado pelo usuário', () => {
  const obra = buildNfseObraPayload(
    {
      codigo: '070602',
      obra: { cno: '123456789012', usarEnderecoTomador: true },
    },
    null,
    {
      issnetOnline30: true,
      obraEndereco: {
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        codigoCidade: '3543402',
        estado: 'SP',
      },
    },
  );
  assert.equal(obra?.codigo, '123456789012');
  assert.equal(obra?.cep, '14000000');
});

test('enrichNfseObraOnEmitPayload — ISSNET RTC anexa endereço da obra', () => {
  const out = enrichNfseObraOnEmitPayload({
    servico: [{ codigo: '070602', discriminacao: 'Gesso' }],
    tomador: {
      endereco: {
        codigoCidade: '3543402',
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        estado: 'SP',
      },
    },
  }, {
    issnetOnline30: true,
    servicosInput: [{ codigo: '070602', obra: { usarEnderecoTomador: true } }],
  });
  assert.equal(out.servico[0].obra?.codigo, undefined);
  assert.equal(out.servico[0].obra?.cep, '14000000');
  assert.equal(out.servico[0].obra?.logradouro, 'Rua A');
  assert.equal(out.servico[0].codigoCidadeIncidencia, '3543402');
});

test('enrichNfseObraOnEmitPayload — legado (não ISSNET) usa codigo placeholder', () => {
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

test('stripCidadePrestacaoForIssnetRtcObra — remove cidadePrestacao ABRASF (E160)', () => {
  const out = stripCidadePrestacaoForIssnetRtcObra({
    cidadePrestacao: {
      codigo: '3543402',
      logradouro: 'Rua A',
      cep: '14000000',
    },
    servico: [{
      codigo: '070602',
      obra: {
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
      },
    }],
  });
  assert.equal(out.cidadePrestacao, undefined);
  assert.equal(out.servico[0].obra.cep, '14000000');
});

test('enrichNfseCidadePrestacaoFromObra — ISSNET RTC obra não envia cidadePrestacao', () => {
  const out = enrichNfseCidadePrestacaoFromObra({
    servico: [{ codigo: '070602' }],
    tomador: {
      endereco: {
        codigoCidade: '3543402',
        descricaoCidade: 'Ribeirão Preto',
        estado: 'SP',
        cep: '14000000',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
      },
    },
  }, {
    issnetOnline30: true,
    servicosInput: [{ codigo: '070602', obra: { usarEnderecoTomador: true } }],
  });
  assert.equal(out.cidadePrestacao, undefined);
});
