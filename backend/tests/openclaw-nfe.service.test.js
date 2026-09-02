import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenclawNfeProdutosMessage,
  formatOpenclawNfeClientesMessage,
  formatOpenclawNfeCatalogoMessage,
  formatOpenclawCatalogServicosMessage,
  formatNfeAskItemDetailsMessage,
  pickExplicitNfeQuantidade,
  pickExplicitNfeValorUnitario,
  catalogHasNfeValorSugerido,
  isCatalogProdutoUsableForNfe,
  extractNfeItemSpecsFromPayload,
  buildNfePreviewFromEmitInput,
} from '../src/services/openclaw-nfe.service.js';
import {
  pickProdutoCatalogoByIndexResult,
  pickProdutoCatalogoByNomeResult,
} from '../src/services/openclaw-nfse.service.js';

test('isCatalogProdutoUsableForNfe — produto completo', () => {
  const ok = isCatalogProdutoUsableForNfe({
    document_type: 'NFE',
    metadata_json: {
      ncm: '22011000',
      cfop: '5102',
      unidade: 'UN',
      icmsCsosn: '102',
      pisCst: '49',
      cofinsCst: '49',
    },
  });
  assert.equal(ok, true);
});

test('isCatalogProdutoUsableForNfe — NFSe ignorado', () => {
  assert.equal(
    isCatalogProdutoUsableForNfe({ document_type: 'NFSE', metadata_json: {} }),
    false,
  );
});

test('formatOpenclawNfeProdutosMessage — lista numerada', () => {
  const msg = formatOpenclawNfeProdutosMessage([
    {
      discriminacao: 'Água 20L',
      codigo: 'AGUA20',
      valor_sugerido: 12,
      metadata_json: { ncm: '22011000', cfop: '5102' },
    },
  ]);
  assert.match(msg, /1\. Água 20L/);
  assert.match(msg, /NCM 22011000/);
  assert.match(msg, /preço R\$ 12/);
});

test('formatOpenclawNfeClientesMessage — lista numerada', () => {
  const msg = formatOpenclawNfeClientesMessage([
    { nome: 'Marli Vasconcelos', documento: '25120730000195' },
  ]);
  assert.match(msg, /1\. Marli Vasconcelos/);
  assert.match(msg, /CNPJ 25120730000195/);
});

test('formatOpenclawNfeCatalogoMessage — clientes e produtos juntos', () => {
  const msg = formatOpenclawNfeCatalogoMessage(
    [{ nome: 'Marli', documento: '12345678901' }],
    [{
      discriminacao: 'Anel de aço',
      codigo: 'ANEL',
      metadata_json: { ncm: '71131900', cfop: '5102' },
    }],
  );
  assert.match(msg, /Marli/);
  assert.match(msg, /Anel de aço/);
  assert.match(msg, /sem preço/);
  assert.match(msg, /Qual cliente e quais produtos/);
});

test('formatNfeAskItemDetailsMessage pede quantidade e preço unitário', () => {
  const msg = formatNfeAskItemDetailsMessage([
    { nome: 'Anel de aço', missingQuantidade: true, missingValor: true },
  ]);
  assert.match(msg, /Anel de aço: falta quantidade e preço unitário/);
  assert.match(msg, /10 itens/);
  assert.match(msg, /Preço: 10 reais/);
});

test('pickExplicitNfeQuantidade e valor — não assume 1 nem preço do catálogo', () => {
  assert.equal(pickExplicitNfeQuantidade({}, {}), undefined);
  assert.equal(pickExplicitNfeQuantidade({ quantidade: 10 }, {}), 10);
  assert.equal(pickExplicitNfeValorUnitario({}, { valor: 10 }), 10);
  assert.equal(pickExplicitNfeValorUnitario({}, {}, { singleItem: false }), undefined);
  assert.equal(catalogHasNfeValorSugerido({ valor_sugerido: 0 }), false);
  assert.equal(catalogHasNfeValorSugerido({ valor_sugerido: 12 }), true);
});

test('formatOpenclawCatalogServicosMessage — serviços NFS-e', () => {
  const msg = formatOpenclawCatalogServicosMessage([
    { discriminacao: 'Manutenção', codigo: '140101', cnae: '4520001', aliquota: 2 },
  ]);
  assert.match(msg, /serviço\(s\) NFS-e/);
  assert.match(msg, /Manutenção/);
});

test('pickProdutoCatalogoByNomeResult — fallback catálogo completo (busca q vazia)', () => {
  const nome = 'Camiseta masculina 100% algodão, manga curta 002';
  const catalog = [{ id: 'p3', discriminacao: nome }];
  const searchRows = [];

  const fromSearch = pickProdutoCatalogoByNomeResult(searchRows, nome);
  assert.equal(fromSearch.kind, 'not_found');

  const fromCatalog = pickProdutoCatalogoByNomeResult(catalog, nome);
  assert.equal(fromCatalog.kind, 'ok');
  assert.equal(fromCatalog.produto.id, 'p3');
});

test('pickProdutoCatalogoByIndexResult — produto 3 da lista numerada', () => {
  const catalog = [
    { id: '1', discriminacao: 'Produto A' },
    { id: '2', discriminacao: 'Produto B' },
    { id: '3', discriminacao: 'Camiseta masculina 100% algodão, manga curta 002' },
  ];
  const result = pickProdutoCatalogoByIndexResult(catalog, 3);
  assert.equal(result.kind, 'ok');
  assert.equal(result.produto.id, '3');
});

test('pickProdutoCatalogoByNomeResult — duplicatas idênticas no catálogo', () => {
  const nome = 'Camiseta masculina 100% algodão, manga curta 002';
  const catalog = [
    { id: 'a', discriminacao: nome, codigo: 'CAM-ALG-001' },
    { id: 'b', discriminacao: nome, codigo: 'CAM-ALG-001' },
    { id: 'c', discriminacao: nome, codigo: 'CAM-ALG-001' },
  ];
  const result = pickProdutoCatalogoByNomeResult(catalog, nome);
  assert.equal(result.kind, 'ok');
  assert.equal(result.produto.id, 'a');
});

test('extractNfeItemSpecsFromPayload — payload legado de 1 produto', () => {
  const specs = extractNfeItemSpecsFromPayload({
    destinatarioNome: 'João',
    produtoNome: 'Camisa branca',
    valor: 5,
    quantidade: 2,
  });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].produtoNome, 'Camisa branca');
  assert.equal(specs[0].valor, 5);
});

test('extractNfeItemSpecsFromPayload — array itens com 2+ produtos', () => {
  const specs = extractNfeItemSpecsFromPayload({
    destinatarioNome: 'João',
    itens: [
      { produtoNome: 'Camisa branca', valor: 5, quantidade: 2 },
      { produtoIndice: 2, valor: 12 },
    ],
  });
  assert.equal(specs.length, 2);
  assert.equal(specs[0].produtoNome, 'Camisa branca');
  assert.equal(specs[0].quantidade, 2);
  assert.equal(specs[1].produtoIndice, 2);
  assert.equal(specs[1].valorUnitario, 12);
});

test('extractNfeItemSpecsFromPayload — aliases produtos e items', () => {
  const viaProdutos = extractNfeItemSpecsFromPayload({
    produtos: [{ produtoNome: 'A', valor: 1 }, { produtoNome: 'B', valor: 2 }],
  });
  const viaItems = extractNfeItemSpecsFromPayload({
    items: [{ produtoId: 'uuid-1', valor: 10 }],
  });
  assert.equal(viaProdutos.length, 2);
  assert.equal(viaItems.length, 1);
  assert.equal(viaItems[0].produtoId, 'uuid-1');
});

test('buildNfePreviewFromEmitInput — soma valor total de todos os itens', () => {
  const preview = buildNfePreviewFromEmitInput({
    destinatario: { cpfCnpj: '07664865751', razaoSocial: 'João', endereco: { estado: 'RJ' } },
    emitente: { cpfCnpj: '35774511000145', endereco: { estado: 'RJ' } },
    itens: [
      {
        descricao: 'Camisa branca',
        codigo: 'CAM',
        ncm: '61091000',
        cfop: '5102',
        quantidade: { comercial: 2 },
        valorUnitario: { comercial: 5 },
        valor: 10,
      },
      {
        descricao: 'Água 20L',
        codigo: 'AGUA',
        ncm: '22011000',
        cfop: '5102',
        quantidade: { comercial: 1 },
        valorUnitario: { comercial: 12 },
        valor: 12,
      },
    ],
  });
  assert.equal(preview.itens.length, 2);
  assert.equal(preview.valorTotal, 22);
  assert.equal(preview.produtoDescricao, 'Camisa branca; Água 20L');
  assert.equal(preview.itens[0].produtoDescricao, 'Camisa branca');
  assert.equal(preview.itens[1].valorTotal, 12);
});

test('buildNfePreviewFromEmitInput — 1 item continua com total da linha', () => {
  const preview = buildNfePreviewFromEmitInput({
    destinatario: { cpfCnpj: '07664865751', razaoSocial: 'João' },
    emitente: { cpfCnpj: '35774511000145' },
    itens: [{
      descricao: 'Camisa branca',
      codigo: 'CAM',
      valor: 5,
      quantidade: { comercial: 1 },
      valorUnitario: { comercial: 5 },
    }],
  });
  assert.equal(preview.itens.length, 1);
  assert.equal(preview.valorTotal, 5);
  assert.equal(preview.produtoDescricao, 'Camisa branca');
});
