import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemTax,
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_ESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL,
  CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER,
  CFOP_VENDA_INTERESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL_ST_ALT,
  CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO,
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
  productHasStTaxation,
  resolveDestinatarioNonTaxpayer,
  resolveEstadualHasSt,
  resolveItemHasSt,
} from '../src/lib/nfe-item-tax-engine.js';
import {
  __resetGetDbForTests,
  __resetTaxRulesSchemaCacheForTests,
  __setGetDbForTests,
  calculateItemsTax,
  lookupTaxRulesStateBatch,
  mergeTaxRulesWithEstadualFallback,
} from '../src/services/nfe-item-tax.service.js';

describe('nfe-item-tax-engine', () => {
  it('resolveEstadualHasSt usa regra da tabela', () => {
    assert.equal(resolveEstadualHasSt({ ncm: '22021000' }, { hasSt: true }), true);
    assert.equal(resolveEstadualHasSt({ ncm: '22021000' }, null), false);
  });

  it('estadual sem ST → 102 / 5102', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ');
    assert.equal(tax.cfop, CFOP_VENDA_ESTADUAL);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(tax.reason, 'estadual_normal');
  });

  it('estadual com ST na tabela → 500 / 5405', () => {
    const tax = calculateItemTax({ ncm: '22021000' }, 'SP', 'SP', { hasSt: true });
    assert.equal(tax.cfop, CFOP_VENDA_ESTADUAL_ST);
    assert.equal(tax.csosn, CSOSN_ST);
    assert.equal(tax.reason, 'estadual_st');
  });

  it('estadual ST via tabela (sem CEST)', () => {
    assert.equal(resolveEstadualHasSt({ ncm: '22021000' }, { hasSt: true }), true);
    const tax = calculateItemTax({ ncm: '22021000' }, 'BA', 'BA', { hasSt: true });
    assert.equal(tax.cfop, CFOP_VENDA_ESTADUAL_ST);
    assert.equal(tax.csosn, CSOSN_ST);
  });

  it('productHasStTaxation (legado) detecta CSOSN 500 e CEST no produto', () => {
    assert.equal(productHasStTaxation({ icmsCsosn: '500' }), true);
    assert.equal(productHasStTaxation({ cest: '0300100' }), true);
    assert.equal(productHasStTaxation({ ncm: '22021000' }), false);
  });

  it('resolveItemHasSt usa somente tabela tax_rules_state', () => {
    assert.equal(resolveItemHasSt({ cest: '0300100' }, null), false);
    assert.equal(resolveItemHasSt({ icmsCsosn: '500' }, null), false);
    assert.equal(resolveItemHasSt({ ncm: '22021000' }, { hasSt: true }), true);
  });

  it('CEST no produto não gera ST sem regra na tabela → 102', () => {
    const tax = calculateItemTax(
      { ncm: '22021000', cest: '0300100' },
      'RJ',
      'SP',
      null,
      'RESELLER',
      { destinatarioDoc: '12345678901' },
    );
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(tax.hasSt, false);
  });

  it('mergeTaxRulesWithEstadualFallback usa ST interna quando par interestadual ausente', () => {
    const direct = new Map();
    const estadual = new Map([['22021000', { hasSt: true, cfopSt: '5405' }]]);
    const merged = mergeTaxRulesWithEstadualFallback(direct, estadual);
    assert.equal(merged.get('22021000')?.hasSt, true);
  });

  it('interestadual sem protocolo ST → 102 / 6102', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'SP', null);
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
  });

  it('interestadual CPF / não contribuinte sem ST → 102 / 6108', () => {
    const tax = calculateItemTax(
      { ncm: '61091000' },
      'RJ',
      'SP',
      null,
      'RESELLER',
      { destinatarioDoc: '12345678901', indIEDest: '9' },
    );
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(tax.reason, 'interestadual_normal_consumidor');
  });

  it('interestadual CPF com ST → 500 / 6108', () => {
    const tax = calculateItemTax(
      { ncm: '22021000' },
      'RJ',
      'SP',
      { hasSt: true },
      'RESELLER',
      { destinatarioDoc: '12345678901' },
    );
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER);
    assert.equal(tax.csosn, CSOSN_ST);
    assert.equal(tax.reason, 'interestadual_st_consumidor');
  });

  it('interestadual CPF com ST e convênio → 500 / 6404', () => {
    const tax = calculateItemTax(
      { ncm: '22021000' },
      'RJ',
      'SP',
      { hasSt: true, cfopSt: CFOP_VENDA_INTERESTADUAL_ST_ALT },
      'RESELLER',
      { indIEDest: '9' },
    );
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO);
    assert.equal(tax.csosn, CSOSN_ST);
  });

  it('resolveDestinatarioNonTaxpayer identifica CPF e indIEDest 9', () => {
    assert.equal(resolveDestinatarioNonTaxpayer({ destinatarioDoc: '12345678901' }), true);
    assert.equal(resolveDestinatarioNonTaxpayer({ indIEDest: '9' }), true);
    assert.equal(resolveDestinatarioNonTaxpayer({
      destinatarioDoc: '01858368000158',
      indIEDest: '1',
      inscricaoEstadual: '123456789',
    }), false);
  });

  it('interestadual com ST → 500 / 6105 ou 6403 (contribuinte)', () => {
    const tax6105 = calculateItemTax({ ncm: '22021000' }, 'RJ', 'SP', { hasSt: true });
    assert.equal(tax6105.cfop, CFOP_VENDA_INTERESTADUAL_ST);
    assert.equal(tax6105.csosn, CSOSN_ST);

    const tax6403 = calculateItemTax({ ncm: '22021000' }, 'RJ', 'SP', {
      hasSt: true,
      cfopSt: CFOP_VENDA_INTERESTADUAL_ST_ALT,
    });
    assert.equal(tax6403.cfop, CFOP_VENDA_INTERESTADUAL_ST_ALT);
  });

  it('indústria sem ST → 5101 / 6101 e ST estadual 5401', () => {
    const estadual = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ', null, 'MANUFACTURER');
    assert.equal(estadual.cfop, '5101');
    const interestadual = calculateItemTax({ ncm: '61091000' }, 'RJ', 'SP', null, 'MANUFACTURER');
    assert.equal(interestadual.cfop, '6101');
    const st = calculateItemTax({ ncm: '22021000' }, 'SP', 'SP', { hasSt: true }, 'MANUFACTURER');
    assert.equal(st.cfop, '5401');
  });
});

describe('nfe-item-tax.service', () => {
  it('calculateItemsTax aplica regras do banco em lote (interestadual)', async () => {
    __resetTaxRulesSchemaCacheForTests();
    __resetGetDbForTests();
    __setGetDbForTests(() => ({
      from: (table) => {
        assert.equal(table, 'tax_rules_state');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({
                  data: [{
                    ncm: '22021000',
                    has_st: true,
                    cfop_st: '6403',
                  }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    }));

    const taxes = await calculateItemsTax({
      originUf: 'RJ',
      destinationUf: 'SP',
      items: [
        { ncm: '61091000' },
        { ncm: '22021000' },
      ],
    });

    assert.equal(taxes.length, 2);
    assert.equal(taxes[0].cfop, CFOP_VENDA_INTERESTADUAL);
    assert.equal(taxes[0].csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(taxes[0].has_st, false);
    assert.equal(taxes[0].cest, null);
    assert.equal(taxes[1].cfop, CFOP_VENDA_INTERESTADUAL_ST_ALT);
    assert.equal(taxes[1].csosn, CSOSN_ST);
    assert.equal(taxes[1].has_st, true);

    __resetGetDbForTests();
  });

  it('lookupTaxRulesStateBatch consulta venda interna (mesma UF)', async () => {
    __resetTaxRulesSchemaCacheForTests();
    __resetGetDbForTests();
    __setGetDbForTests(() => ({
      from: () => ({
        select: () => ({
          eq: (col, val) => {
            assert.equal(col, 'origin_uf');
            assert.equal(val, 'RJ');
            return {
              eq: (col2, val2) => {
                assert.equal(col2, 'destination_uf');
                assert.equal(val2, 'RJ');
                return {
                  in: async () => ({
                    data: [{ ncm: '22021000', has_st: true, cfop_st: '5405' }],
                    error: null,
                  }),
                };
              },
            };
          },
        }),
      }),
    }));

    const map = await lookupTaxRulesStateBatch({
      ncms: ['22021000'],
      originUf: 'RJ',
      destinationUf: 'RJ',
    });
    assert.equal(map.size, 1);
    assert.equal(map.get('22021000')?.hasSt, true);

    const taxes = await calculateItemsTax({
      originUf: 'RJ',
      destinationUf: 'RJ',
      items: [{ ncm: '22021000' }],
    });
    assert.equal(taxes[0].cfop, CFOP_VENDA_ESTADUAL_ST);
    assert.equal(taxes[0].csosn, CSOSN_ST);

    __resetGetDbForTests();
  });

  it('vestuário (61091000) nunca recebe ST mesmo com csosn 500 no item', async () => {
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

    const taxes = await calculateItemsTax({
      originUf: 'RJ',
      destinationUf: 'RJ',
      items: [{ ncm: '61091000', icmsCsosn: '500', cest: '0300100' }],
    });
    assert.equal(taxes[0].cfop, CFOP_VENDA_ESTADUAL);
    assert.equal(taxes[0].csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(taxes[0].has_st, false);
    assert.equal(taxes[0].cest, null);

    __resetGetDbForTests();
  });
});

