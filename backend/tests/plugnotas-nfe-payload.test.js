import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractNfeItemQuantidade,
  extractNfeItemValorUnitario,
  normalizeNfePisCofinsForPlugnotasSn,
  normalizePlugnotasNfeIdeForEmit,
  destinatarioMapsToNaoContribuinteOnPlugnotas,
  normalizePlugnotasNfePayload,
} from '../src/services/plugnotas/plugnotas-nfe-payload.js';

test('extractNfeItemValorUnitario aceita número simples', () => {
  assert.equal(extractNfeItemValorUnitario({ valorUnitario: 12 }), 12);
  assert.equal(extractNfeItemValorUnitario({ valorUnitario: '12,50' }), 12.5);
});

test('extractNfeItemValorUnitario aceita objeto Plugnotas', () => {
  assert.equal(
    extractNfeItemValorUnitario({ valorUnitario: { comercial: 12, tributavel: 12 } }),
    12,
  );
});

test('normalizeNfePisCofinsForPlugnotasSn completa CST 49 com zeros', () => {
  assert.deepEqual(normalizeNfePisCofinsForPlugnotasSn({ cst: '49' }), {
    cst: '49',
    baseCalculo: { valor: 0 },
    aliquota: 0,
    valor: 0,
  });
});

test('normalizePlugnotasNfeIdeForEmit preenche intermediador e consumidorFinal', () => {
  const out = normalizePlugnotasNfeIdeForEmit({
    destinatario: {
      cpfCnpj: '01858368000158',
      indIEDest: '2',
    },
    consumidorFinal: false,
  });
  assert.equal(out.intermediador, 0);
  assert.equal(out.consumidorFinal, true);
});

test('destinatarioMapsToNaoContribuinteOnPlugnotas detecta CNPJ sem IE', () => {
  assert.equal(
    destinatarioMapsToNaoContribuinteOnPlugnotas({ cpfCnpj: '01858368000158', indIEDest: '2' }),
    true,
  );
  assert.equal(
    destinatarioMapsToNaoContribuinteOnPlugnotas({
      cpfCnpj: '01858368000158',
      indIEDest: '1',
      inscricaoEstadual: '12345678',
    }),
    false,
  );
});

test('normalizePlugnotasNfePayload inclui CEST normalizado em item com ST', () => {
  const out = normalizePlugnotasNfePayload({
    itens: [{
      codigo: '001',
      descricao: 'Refrigerante Cola 2L PET',
      ncm: '22021000',
      cfop: '6108',
      unidadeComercial: 'UN',
      quantidade: 1,
      valorUnitario: 8,
      cest: '03.001.00',
      tributos: {
        icms: { origem: '0', csosn: '500' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
  });

  assert.equal(out.itens[0].cest, '0300100');
});

test('normalizePlugnotasNfePayload infere CEST pela descrição em item ST', () => {
  const out = normalizePlugnotasNfePayload({
    itens: [{
      codigo: '001',
      descricao: 'Cerveja Pilsen 350ml Lata',
      ncm: '22030000',
      cfop: '5405',
      unidadeComercial: 'UN',
      quantidade: 1,
      valorUnitario: 5,
      tributos: {
        icms: { origem: '0', cst: '500' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
  });

  assert.equal(out.itens[0].cest, '0300300');
});

test('normalizePlugnotasNfePayload não inclui CEST em item sem ST mesmo com descrição ST', () => {
  const out = normalizePlugnotasNfePayload({
    itens: [{
      codigo: '001',
      descricao: 'Refrigerante Cola 2L PET',
      ncm: '22021000',
      cfop: '5102',
      unidadeComercial: 'UN',
      quantidade: 1,
      valorUnitario: 8,
      cest: '03.001.00',
      tributos: {
        icms: { origem: '0', csosn: '102' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
  });

  assert.equal(out.itens[0].cest, undefined);
});

test('normalizePlugnotasNfePayload converte item flat para formato Plugnotas', () => {
  const out = normalizePlugnotasNfePayload({
    itens: [{
      codigo: '001',
      descricao: 'Agua',
      ncm: '22011000',
      cfop: '5102',
      unidadeComercial: 'UN',
      quantidade: 42,
      valorUnitario: 12,
      tributos: {
        icms: { origem: '0', csosn: '102' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
  });

  const item = out.itens[0];
  assert.deepEqual(item.quantidade, { comercial: 42, tributavel: 42 });
  assert.deepEqual(item.valorUnitario, { comercial: 12, tributavel: 12 });
  assert.equal(item.valor, 504);
  assert.equal(item.tributos.icms.cst, '102');
  assert.equal(item.tributos.icms.csosn, undefined);
  assert.deepEqual(item.tributos.pis, {
    cst: '49',
    baseCalculo: { valor: 0 },
    aliquota: 0,
    valor: 0,
  });
  assert.deepEqual(item.tributos.cofins, {
    cst: '49',
    baseCalculo: { valor: 0 },
    aliquota: 0,
    valor: 0,
  });
});

test('normalizePlugnotasNfePayload preenche descricaoMeio quando meio é 99', () => {
  const out = normalizePlugnotasNfePayload({
    pagamentos: [{ meio: '99', valor: 504 }],
  });
  assert.deepEqual(out.pagamentos, [{ meio: '99', valor: 504, descricaoMeio: 'Outros' }]);
});

test('extractNfeItemQuantidade aceita número simples e objeto', () => {
  assert.equal(extractNfeItemQuantidade({ quantidade: 42 }), 42);
  assert.equal(
    extractNfeItemQuantidade({ quantidade: { comercial: 3, tributavel: 3 } }),
    3,
  );
});
