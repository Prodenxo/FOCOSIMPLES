import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenclawNfeProdutosMessage,
  formatOpenclawCatalogServicosMessage,
  isCatalogProdutoUsableForNfe,
} from '../src/services/openclaw-nfe.service.js';

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
});

test('formatOpenclawCatalogServicosMessage — serviços NFS-e', () => {
  const msg = formatOpenclawCatalogServicosMessage([
    { discriminacao: 'Manutenção', codigo: '140101', cnae: '4520001', aliquota: 2 },
  ]);
  assert.match(msg, /serviço\(s\) NFS-e/);
  assert.match(msg, /Manutenção/);
});
