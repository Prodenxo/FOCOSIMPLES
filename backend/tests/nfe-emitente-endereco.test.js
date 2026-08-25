import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emitenteHasNfeTaxUf,
  mapNfeEmitenteEnderecoFromCertificateSnapshot,
} from '../src/lib/nfe-emitente-endereco.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../src/lib/nfe-like-payload-tax-apply.js';
import {
  __resetGetDbForTests,
  __resetTaxRulesSchemaCacheForTests,
  __setGetDbForTests,
} from '../src/services/nfe-item-tax.service.js';

test('mapNfeEmitenteEnderecoFromCertificateSnapshot — snapshot MEI', () => {
  const endereco = mapNfeEmitenteEnderecoFromCertificateSnapshot({
    tipo_logradouro: 'Rua',
    logradouro: 'Brasil',
    numero: '100',
    ibge_municipio: '3304557',
    cep: '20040020',
    bairro: 'Centro',
    uf: 'RJ',
    cidade: 'Rio de Janeiro',
  });
  assert.equal(endereco?.estado, 'RJ');
  assert.equal(endereco?.codigoCidade, '3304557');
  assert.match(endereco?.logradouro || '', /Rua Brasil/);
});

test('recalculateNfeLikePayloadTaxForEmit — RJ→MA usa CFOP interestadual', async () => {
  __resetTaxRulesSchemaCacheForTests();
  __resetGetDbForTests();
  __setGetDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }));

  const payload = {
    emitente: { endereco: { estado: 'RJ' } },
    destinatario: {
      cpfCnpj: '07664865751',
      indIEDest: '9',
      endereco: { estado: 'MA' },
    },
    itens: [{
      ncm: '61091000',
      cfop: '5102',
      descricao: 'Camiseta masculina',
      tributos: { icms: { cst: '102' }, pis: { cst: '49' }, cofins: { cst: '49' } },
    }],
  };

  const out = await recalculateNfeLikePayloadTaxForEmit(payload);
  assert.notEqual(out.itens[0].cfop, '5102');
  assert.match(out.itens[0].cfop, /^6/);

  __resetGetDbForTests();
});

test('emitenteHasNfeTaxUf — detecta UF no endereço', () => {
  assert.equal(emitenteHasNfeTaxUf({ endereco: { estado: 'RJ' } }), true);
  assert.equal(emitenteHasNfeTaxUf({}), false);
});
