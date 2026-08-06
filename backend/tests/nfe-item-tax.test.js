import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemTax,
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_ESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL,
  CFOP_VENDA_INTERESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL_ST_ALT,
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
  productHasCest,
  resolveEstadualHasSt,
} from '../src/lib/nfe-item-tax-engine.js';
import {
  __resetGetDbForTests,
  __resetTaxRulesSchemaCacheForTests,
  __setGetDbForTests,
  calculateItemsTax,
  lookupTaxRulesStateBatch,
} from '../src/services/nfe-item-tax.service.js';

describe('nfe-item-tax-engine', () => {
  it('detecta CEST no produto', () => {
    assert.equal(productHasCest({ cest: '2803800' }), true);
    assert.equal(productHasCest({ cest: '' }), false);
  });

  it('estadual sem ST → 102 / 5102', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ');
    assert.equal(tax.cfop, CFOP_VENDA_ESTADUAL);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(tax.reason, 'estadual_normal');
  });

  it('estadual com CEST → 500 / 5405', () => {
    const tax = calculateItemTax({ ncm: '22021000', cest: '0300100' }, 'SP', 'SP');
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

  it('interestadual sem protocolo ST → 102 / 6102', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'SP', null);
    assert.equal(tax.cfop, CFOP_VENDA_INTERESTADUAL);
    assert.equal(tax.csosn, CSOSN_TRIBUTADO_SN);
  });

  it('interestadual com ST → 500 / 6105 ou 6403', () => {
    const tax6105 = calculateItemTax({ ncm: '22021000' }, 'RJ', 'SP', { hasSt: true });
    assert.equal(tax6105.cfop, CFOP_VENDA_INTERESTADUAL_ST);
    assert.equal(tax6105.csosn, CSOSN_ST);

    const tax6403 = calculateItemTax({ ncm: '22021000' }, 'RJ', 'SP', {
      hasSt: true,
      cfopSt: CFOP_VENDA_INTERESTADUAL_ST_ALT,
    });
    assert.equal(tax6403.cfop, CFOP_VENDA_INTERESTADUAL_ST_ALT);
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
    assert.equal(taxes[1].cfop, CFOP_VENDA_INTERESTADUAL_ST_ALT);
    assert.equal(taxes[1].csosn, CSOSN_ST);

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
                    data: [{ ncm: '61091000', has_st: true, cfop_st: null }],
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
      ncms: ['61091000'],
      originUf: 'RJ',
      destinationUf: 'RJ',
    });
    assert.equal(map.size, 1);
    assert.equal(map.get('61091000')?.hasSt, true);

    const taxes = await calculateItemsTax({
      originUf: 'RJ',
      destinationUf: 'RJ',
      items: [{ ncm: '61091000' }],
    });
    assert.equal(taxes[0].cfop, CFOP_VENDA_ESTADUAL_ST);

    __resetGetDbForTests();
  });
});
