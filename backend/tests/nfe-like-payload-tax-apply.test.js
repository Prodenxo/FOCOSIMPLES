import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetGetDbForTests,
  __resetTaxRulesSchemaCacheForTests,
  __setGetDbForTests,
} from '../src/services/nfe-item-tax.service.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../src/lib/nfe-like-payload-tax-apply.js';
import {
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_ESTADUAL_ST,
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
} from '../src/lib/nfe-item-tax-engine.js';

describe('nfe-like-payload-tax-apply', () => {
  it('recalcula camisa 61091000 RJ→RJ para 102/5102 e remove CEST', async () => {
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
        cpfCnpj: '12345678901',
        indIEDest: '9',
        endereco: { estado: 'RJ' },
      },
      itens: [{
        ncm: '61091000',
        cfop: '5405',
        cest: '0300100',
        descricao: 'Camisa algodão',
        tributos: { icms: { csosn: '500', cst: '500' } },
      }],
    };

    const out = await recalculateNfeLikePayloadTaxForEmit(payload);
    assert.equal(out.itens[0].cfop, CFOP_VENDA_ESTADUAL);
    assert.equal(out.itens[0].tributos.icms.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(out.itens[0].cest, undefined);

    __resetGetDbForTests();
  });

  it('mantém ST/CEST para bebida com regra na tabela', async () => {
    __resetTaxRulesSchemaCacheForTests();
    __resetGetDbForTests();
    __setGetDbForTests(() => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: async () => ({
                data: [{ ncm: '22021000', has_st: true, cfop_st: '5405' }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));

    const payload = {
      emitente: { endereco: { estado: 'RJ' } },
      destinatario: { endereco: { estado: 'RJ' } },
      itens: [{
        ncm: '22021000',
        cest: '0300100',
        descricao: 'Refrigerante PET 2L',
        tributos: { icms: { csosn: '102' } },
      }],
    };

    const out = await recalculateNfeLikePayloadTaxForEmit(payload);
    assert.equal(out.itens[0].cfop, CFOP_VENDA_ESTADUAL_ST);
    assert.equal(out.itens[0].tributos.icms.csosn, CSOSN_ST);
    assert.equal(out.itens[0].cest, '0300100');

    __resetGetDbForTests();
  });

  it('usa CFOP/CSOSN da regra APPROVED do contador quando há match', async () => {
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

    const approvedRule = {
      id: 'rule-cfop-5123',
      tenantId: 'tenant-1',
      version: 1,
      status: 'APPROVED',
      establishmentId: '11222333000181',
      conditions: {
        crt: [1],
        productId: ['prod-camisa'],
        operationType: ['VENDA'],
        operationScope: ['INTERSTATE'],
        itemSource: ['THIRD_PARTY'],
        priorStStatus: ['UNKNOWN'],
        origem: ['0'],
      },
      approvedResult: {
        cfop: '5123',
        csosn: '102',
        icmsGroup: 'ICMSSN102',
        currentOperationSt: 'NOT_DUE',
      },
    };

    const payload = {
      emitente: {
        cpfCnpj: '11222333000181',
        endereco: { estado: 'RJ' },
        crt: 1,
      },
      destinatario: {
        cpfCnpj: '12345678901',
        indIEDest: '9',
        endereco: { estado: 'SP' },
      },
      itens: [{
        codigo: 'asdasdasd',
        ncm: '61091000',
        descricao: 'Camisa',
        tributos: { icms: { csosn: '102' } },
      }],
    };

    const out = await recalculateNfeLikePayloadTaxForEmit(payload, {
      tenantId: 'tenant-1',
      approvedRulesCache: [approvedRule],
      resolveCatalogProductId: async () => 'prod-camisa',
    });

    assert.equal(out.itens[0].cfop, '5123');
    assert.equal(out.itens[0].tributos.icms.csosn, '102');

    __resetGetDbForTests();
  });

  it('não marca ST/CEST quando regra tem CSOSN 500 mas NCM sem ST na matriz', async () => {
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

    const approvedRule = {
      id: 'rule-csosn-500-sem-st',
      tenantId: 'tenant-1',
      version: 1,
      status: 'APPROVED',
      establishmentId: '11222333000181',
      conditions: {
        crt: [1],
        productId: ['prod-camisa'],
        operationType: ['VENDA'],
        operationScope: ['INTERNAL'],
        itemSource: ['THIRD_PARTY'],
        priorStStatus: ['UNKNOWN'],
        origem: ['0'],
      },
      approvedResult: {
        cfop: '5253',
        csosn: '500',
        icmsGroup: 'ICMSSN500',
        currentOperationSt: 'NOT_DUE',
      },
    };

    const payload = {
      emitente: {
        cpfCnpj: '11222333000181',
        endereco: { estado: 'RJ' },
        crt: 1,
      },
      destinatario: {
        cpfCnpj: '12345678901',
        indIEDest: '9',
        endereco: { estado: 'RJ' },
      },
      itens: [{
        codigo: 'asdasdasd',
        ncm: '61091000',
        descricao: 'Camisa',
        tributos: { icms: { csosn: '500' } },
      }],
    };

    const out = await recalculateNfeLikePayloadTaxForEmit(payload, {
      tenantId: 'tenant-1',
      approvedRulesCache: [approvedRule],
      resolveCatalogProductId: async () => 'prod-camisa',
    });

    assert.equal(out.itens[0].cfop, '5253');
    assert.equal(out.itens[0].tributos.icms.csosn, CSOSN_TRIBUTADO_SN);
    assert.equal(out.itens[0].cest, undefined);

    __resetGetDbForTests();
  });
});
