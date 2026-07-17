import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPlugnotasIbgeTableRejectMessage,
  normalizeForMatchPlugnotasIbge
} from '../src/utils/plugnotasIbgeTableRejectMessage.js';

test('normalizeForMatchPlugnotasIbge remove acentos e lowercases', () => {
  assert.equal(normalizeForMatchPlugnotasIbge('Tabela IBGE'), 'tabela ibge');
});

test('isPlugnotasIbgeTableRejectMessage: TIBGE-L1 codigoIBGECidade + tabela', () => {
  assert.equal(
    isPlugnotasIbgeTableRejectMessage(
      'Falha na validação: fields.endereco.codigoIBGECidade — valor não encontrado na tabela de cidades do IBGE.'
    ),
    true
  );
});

test('isPlugnotasIbgeTableRejectMessage: fields.endereco.codigoCidade', () => {
  assert.equal(
    isPlugnotasIbgeTableRejectMessage(
      'HTTP 400: fields.endereco.codigoCidade não localizado na tabela IBGE.'
    ),
    true
  );
});

test('isPlugnotasIbgeTableRejectMessage: PREF-L1 puro sem sinais IBGE cidade → false', () => {
  assert.equal(
    isPlugnotasIbgeTableRejectMessage(
      'Falha na validação do JSON de Empresa: fields.nfse.config.prefeitura: Preenchimento obrigatório'
    ),
    false
  );
});

test('isPlugnotasIbgeTableRejectMessage: mensagem genérica 400 → false', () => {
  assert.equal(isPlugnotasIbgeTableRejectMessage('Informe a razão social.'), false);
});
