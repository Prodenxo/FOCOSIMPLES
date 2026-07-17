import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenclawNfseProdutosMessage,
  hasExplicitNfseServicoSelection,
  isNfsePdfReadyStatus,
  normalizeCatalogDiscriminacao,
  parseValorReais,
  pickClienteCatalogoByNomeResult,
  pickProdutoCatalogoByCodigoCnaeResult,
  pickProdutoCatalogoByCodigoResult,
  pickProdutoCatalogoByNomeResult,
} from '../src/services/openclaw-nfse.service.js';
import { formatNfseCatalogChoiceMessage } from '../src/services/openclaw-nf-user-messages.js';

/** Valor da nota fiscal (emit_nfse), não lançamento financeiro. */
test('parseValorReais NFSe — número e formato BR', () => {
  assert.equal(parseValorReais(1200), 1200);
  assert.equal(parseValorReais('1200'), 1200);
  assert.equal(parseValorReais('1.200,00'), 1200);
  assert.equal(parseValorReais('1.200'), 1200);
});

test('parseValorReais NFSe — mil e milhão (valor da nota)', () => {
  assert.equal(parseValorReais('350 mil'), 350000);
  assert.equal(parseValorReais('1 milhão e 200 mil'), 1200000);
  assert.equal(parseValorReais('2 milhões'), 2000000);
});

test('parseValorReais NFSe — inválido', () => {
  assert.equal(parseValorReais(''), null);
  assert.equal(parseValorReais('abc'), null);
  assert.equal(parseValorReais(0), null);
});

test('isNfsePdfReadyStatus', () => {
  assert.equal(isNfsePdfReadyStatus('concluido'), true);
  assert.equal(isNfsePdfReadyStatus('processando'), false);
  assert.equal(isNfsePdfReadyStatus('autorizado'), true);
});

test('pickClienteCatalogoByNomeResult — match exato', () => {
  const rows = [
    { id: '1', nome: 'Rafael Reis', documento: '12345678901' },
    { id: '2', nome: 'Maria Silva', documento: '98765432100' },
  ];
  const r = pickClienteCatalogoByNomeResult(rows, 'Rafael Reis');
  assert.equal(r.kind, 'ok');
  assert.equal(r.cliente.id, '1');
});

test('pickClienteCatalogoByNomeResult — match por palavras', () => {
  const rows = [
    { id: '1', nome: 'Rafael Reis Ltda', documento: '65805583000173' },
    { id: '2', nome: 'Rafael Costa', documento: '11122233344' },
  ];
  const r = pickClienteCatalogoByNomeResult(rows, 'Rafael Reis');
  assert.equal(r.kind, 'ok');
  assert.equal(r.cliente.id, '1');
});

test('pickClienteCatalogoByNomeResult — ambíguo', () => {
  const rows = [
    { id: '1', nome: 'Rafael Reis', documento: '12345678901' },
    { id: '2', nome: 'Rafael Costa', documento: '98765432100' },
  ];
  const r = pickClienteCatalogoByNomeResult(rows, 'Rafael');
  assert.equal(r.kind, 'ambiguous');
  assert.equal(r.matches.length, 2);
});

test('pickClienteCatalogoByNomeResult — único resultado da busca', () => {
  const rows = [{ id: '1', nome: 'José Antônio', documento: '12345678901' }];
  const r = pickClienteCatalogoByNomeResult(rows, 'Jose');
  assert.equal(r.kind, 'ok');
  assert.equal(r.cliente.id, '1');
});

test('pickClienteCatalogoByNomeResult — catálogo NFSe filtrado ignora duplicata NF-e', () => {
  const rowsNfseOnly = [
    { id: 'nfse-1', nome: 'Leonardo de Lima', documento: '11953257704', document_type: 'NFSE' },
  ];
  const r = pickClienteCatalogoByNomeResult(rowsNfseOnly, 'Leonardo de Lima');
  assert.equal(r.kind, 'ok');
  assert.equal(r.cliente.id, 'nfse-1');
});

test('hasExplicitNfseServicoSelection — índice ou código contam; texto livre não', () => {
  assert.equal(hasExplicitNfseServicoSelection({ descricao: 'pintura' }), false);
  assert.equal(hasExplicitNfseServicoSelection({ tomadorNome: 'Rafael', valor: 2 }), false);
  assert.equal(hasExplicitNfseServicoSelection({ servicoIndice: 2 }), true);
  assert.equal(hasExplicitNfseServicoSelection({ codigoServico: '140101' }), true);
});

test('normalizeCatalogDiscriminacao ignora pontuação final', () => {
  const a = normalizeCatalogDiscriminacao(
    'Serviços de manutenção e reparação mecânica de veículos automotores, incluindo revisão.',
  );
  const b = normalizeCatalogDiscriminacao(
    'Serviços de manutenção e reparação mecânica de veículos automotores, incluindo revisão',
  );
  assert.equal(a, b);
});

test('formatNfseCatalogChoiceMessage — prefixo quando falta escolha do serviço', () => {
  const msg = formatNfseCatalogChoiceMessage(
    [{ discriminacao: 'Manutenção de computador' }],
    { prefix: 'Ainda não escolheu o serviço. Qual vai na nota?' },
  );
  assert.match(msg, /Ainda não escolheu/);
  assert.match(msg, /1\. Manutenção de computador/);
});

test('pickProdutoCatalogoByCodigoResult — apenas código municipal', () => {
  const rows = [
    {
      id: '1',
      discriminacao:
        'Serviços de manutenção e reparação mecânica de veículos automotores, incluindo revisão',
      codigo: '140101',
      cnae: '4520001',
    },
  ];
  const r = pickProdutoCatalogoByCodigoResult(rows, '140101');
  assert.equal(r.kind, 'ok');
  assert.equal(r.produto.id, '1');
});

test('pickProdutoCatalogoByNomeResult — descrição abreviada pelo bot', () => {
  const rows = [
    {
      id: '1',
      discriminacao:
        'Serviços de manutenção e reparação mecânica de veículos automotores, incluindo revisão',
      codigo: '140101',
      cnae: '4520001',
    },
  ];
  const r = pickProdutoCatalogoByNomeResult(
    rows,
    'Serviço de manutenção e reparação mecânica de veículos automotores',
  );
  assert.equal(r.kind, 'ok');
  assert.equal(r.produto.id, '1');
});

test('pickProdutoCatalogoByCodigoCnaeResult — reutiliza serviço existente (evita duplicata)', () => {
  const rows = [
    {
      id: '1',
      discriminacao: 'Serviços de manutenção e reparação mecânica de veículos',
      codigo: '140101',
      cnae: '4520001',
    },
    {
      id: '2',
      discriminacao: 'serviço de pintura',
      codigo: '070202',
      cnae: '4211102',
    },
  ];
  const r = pickProdutoCatalogoByCodigoCnaeResult(rows, '14.01.01', '4520-0/01');
  assert.equal(r.kind, 'ok');
  assert.equal(r.produto.id, '1');
});

test('pickProdutoCatalogoByNomeResult — match por palavras na discriminação', () => {
  const rows = [
    { id: '1', discriminacao: 'Pintura para sinalização em pistas', codigo: '140101', cnae: '4330404' },
    { id: '2', discriminacao: 'Consultoria em TI', codigo: '010701', cnae: '6201500' },
  ];
  const r = pickProdutoCatalogoByNomeResult(rows, 'pintura sinalização');
  assert.equal(r.kind, 'ok');
  assert.equal(r.produto.id, '1');
});

test('formatOpenclawNfseProdutosMessage — lista formatada', () => {
  const msg = formatOpenclawNfseProdutosMessage([
    { discriminacao: 'Pintura', codigo: '140101', cnae: '4330404', aliquota: 2 },
  ]);
  assert.match(msg, /1 serviço/);
  assert.match(msg, /Pintura/);
  assert.match(msg, /CNAE 4330404/);
});
