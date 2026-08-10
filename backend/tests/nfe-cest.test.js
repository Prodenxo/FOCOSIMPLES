import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferCestFromProductDescription,
  itemHasStIcms,
  normalizeCestForPlugnotas,
  resolveItemCestForPlugnotas,
  validateNfeCatalogProdutoMetadata,
} from '../src/lib/nfe-cest.js';

describe('nfe-cest', () => {
  it('normalizeCestForPlugnotas remove pontuação', () => {
    assert.equal(normalizeCestForPlugnotas('03.001.00'), '0300100');
    assert.equal(normalizeCestForPlugnotas('0301001'), '0301001');
  });

  it('inferCestFromProductDescription detecta PET', () => {
    assert.equal(
      inferCestFromProductDescription('22021000', 'Refrigerante Cola 2L PET'),
      '0300100',
    );
  });

  it('itemHasStIcms detecta CSOSN 500', () => {
    assert.equal(itemHasStIcms({ tributos: { icms: { csosn: '500' } } }), true);
    assert.equal(itemHasStIcms({ tributos: { icms: { cst: '500' } } }), true);
    assert.equal(itemHasStIcms({ tributos: { icms: { csosn: '102' } } }), false);
  });

  it('itemHasStIcms prioriza csosn 102 sobre cst 500 legado', () => {
    assert.equal(
      itemHasStIcms({ tributos: { icms: { csosn: '102', cst: '500' } } }),
      false,
    );
  });

  it('resolveItemCestForPlugnotas prioriza campo e infere descrição em item ST', () => {
    assert.equal(
      resolveItemCestForPlugnotas({
        tributos: { icms: { csosn: '500' } },
        ncm: '22021000',
        descricao: 'Refri PET',
        cest: '03.001.00',
      }),
      '0300100',
    );
    assert.equal(
      resolveItemCestForPlugnotas({
        tributos: { icms: { csosn: '500' } },
        ncm: '22030000',
        descricao: 'Cerveja Lata',
      }),
      '0300300',
    );
  });

  it('resolveItemCestForPlugnotas ignora CEST quando CSOSN não é 500', () => {
    assert.equal(
      resolveItemCestForPlugnotas({
        tributos: { icms: { csosn: '102' } },
        ncm: '22021000',
        descricao: 'Refri PET',
        cest: '03.001.00',
      }),
      null,
    );
  });

  it('validateNfeCatalogProdutoMetadata exige CEST só com hasSt + CSOSN 500', () => {
    assert.doesNotThrow(
      () => validateNfeCatalogProdutoMetadata(
        { ncm: '22021000', icmsCsosn: '500' },
        { discriminacao: 'Refri' },
      ),
    );
    assert.throws(
      () => validateNfeCatalogProdutoMetadata(
        { ncm: '22021000', icmsCsosn: '500', hasSt: true },
        { discriminacao: 'Refri' },
      ),
      /CSOSN 500 exigem CEST/,
    );
    assert.doesNotThrow(
      () => validateNfeCatalogProdutoMetadata(
        { ncm: '22021000', icmsCsosn: '500', hasSt: true },
        { discriminacao: 'Refrigerante PET' },
      ),
    );
    assert.doesNotThrow(
      () => validateNfeCatalogProdutoMetadata(
        { ncm: '22021000', hasSt: true },
        { discriminacao: 'Refri' },
      ),
    );
  });
});
