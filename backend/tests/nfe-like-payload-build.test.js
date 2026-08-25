import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('buildNfeLikePayloadFromInput preserva pagamentos e consumidorFinal', async () => {
  const { buildNfeLikePayloadFromInput } = await import('../src/services/mei-notas.service.js');

  const { payload } = buildNfeLikePayloadFromInput({
    documentType: 'NFE',
    emitente: { cpfCnpj: '35774511000145', razaoSocial: 'Emitente Teste' },
    destinatario: {
      cpfCnpj: '07664865751',
      razaoSocial: 'Arthur Ferreira',
      indIEDest: '9',
      endereco: {
        cep: '65995970',
        logradouro: 'Avenida Brasil 213',
        numero: '27',
        bairro: 'Centro',
        codigoCidade: '2104073',
        descricaoCidade: 'Feira Nova do Maranhão',
        estado: 'MA',
      },
    },
    consumidorFinal: true,
    itens: [{
      codigo: 'CAM-ALG-001',
      descricao: 'Camiseta masculina',
      ncm: '61091000',
      cfop: '6108',
      unidadeComercial: 'UN',
      quantidade: { comercial: 1, tributavel: 1 },
      valorUnitario: { comercial: 39.9, tributavel: 39.9 },
      valor: 39.9,
      tributos: {
        icms: { origem: '0', csosn: '102' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
    pagamentos: [{ meio: '99', valor: 39.9, descricaoMeio: 'Outros' }],
    config: { producao: true },
  }, 'user-test');

  assert.deepEqual(payload.pagamentos, [{ meio: '99', valor: 39.9, descricaoMeio: 'Outros' }]);
  assert.equal(payload.consumidorFinal, true);
  assert.equal(payload.config.producao, true);
});

test('buildNfeLikePayloadFromInput gera pagamentos quando ausentes', async () => {
  const { buildNfeLikePayloadFromInput } = await import('../src/services/mei-notas.service.js');

  const { payload } = buildNfeLikePayloadFromInput({
    emitente: { cpfCnpj: '35774511000145' },
    destinatario: { cpfCnpj: '07664865751', razaoSocial: 'Cliente' },
    itens: [{
      codigo: '001',
      descricao: 'Produto',
      ncm: '61091000',
      cfop: '6108',
      quantidade: 2,
      valorUnitario: 10,
      valor: 20,
      tributos: {
        icms: { origem: '0', csosn: '102' },
        pis: { cst: '49' },
        cofins: { cst: '49' },
      },
    }],
  }, 'user-test');

  assert.deepEqual(payload.pagamentos, [{ meio: '99', valor: 20, descricaoMeio: 'Outros' }]);
});
