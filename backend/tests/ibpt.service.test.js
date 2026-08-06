import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetIbptCacheForTests,
  __setFetchImplForTests,
  __setIbptDbCacheEnabledForTests,
  buildIbptCacheKey,
  buildIbptProdutosUrl,
  calcularBreakdownTributosIbpt,
  calcularValorTributosIbpt,
  consultarProdutoIbpt,
  IBPT_API_URL,
  isIbptOfflineError,
  isOrigemMercadoriaImportada,
  resolveIbptFallbackAliquotas,
} from '../src/services/ibpt.service.js';

const mockIbptBody = {
  Nacional: 13.45,
  Estadual: 18,
  Importado: 20.91,
  Municipal: 0,
  Fonte: 'IBPT/empresometro.com.br',
  Versao: '25.1.A',
};

describe('ibpt.service', () => {
  beforeEach(() => {
    __resetIbptCacheForTests();
    __setIbptDbCacheEnabledForTests(false);
  });

  it('buildIbptCacheKey normaliza UF e NCM', () => {
    assert.equal(buildIbptCacheKey('sp', '22030000', '0'), 'SP:22030000:0');
  });

  it('isOrigemMercadoriaImportada identifica origens importadas', () => {
    assert.equal(isOrigemMercadoriaImportada('1'), true);
    assert.equal(isOrigemMercadoriaImportada('0'), false);
  });

  it('calcularValorTributosIbpt usa Nacional + Estadual + Municipal', () => {
    const total = calcularValorTributosIbpt(mockIbptBody, 100, '0');
    assert.equal(total, 31.45);
  });

  it('calcularValorTributosIbpt usa Importado para origem estrangeira', () => {
    const total = calcularValorTributosIbpt(mockIbptBody, 100, '1');
    assert.equal(total, 38.91);
  });

  it('calcularBreakdownTributosIbpt detalha valores', () => {
    const b = calcularBreakdownTributosIbpt(mockIbptBody, 10, '0');
    assert.equal(b.federal, 1.35);
    assert.equal(b.estadual, 1.8);
    assert.equal(b.total, 3.15);
  });

  it('buildIbptProdutosUrl usa endpoint oficial e NCM sem pontos', () => {
    const url = buildIbptProdutosUrl({
      token: 'tok-test',
      cnpj: '01858368000158',
      codigoNcm: '2202.10.00',
      uf: 'RJ',
      ex: '0',
      descricao: 'Refrigerante',
      unidadeMedida: 'UN',
      valor: '12,50',
      gtin: 'SEM GTIN',
    });
    assert.ok(url.startsWith(`${IBPT_API_URL}?`));
    assert.ok(url.startsWith('https://apiv2.ibpt.org.br/api/v1/produtos?'));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('codigo'), '22021000');
    assert.equal(parsed.searchParams.get('cnpj'), '01858368000158');
    assert.equal(parsed.searchParams.get('uf'), 'RJ');
    assert.equal(parsed.searchParams.get('valor'), '12.50');
    assert.equal(parsed.searchParams.get('gtin'), 'SEM GTIN');
  });

  it('consultarProdutoIbpt envia headers User-Agent e Accept', async () => {
    /** @type {RequestInit | undefined} */
    let capturedInit;
    __setFetchImplForTests(async (_url, init) => {
      capturedInit = init;
      return {
        ok: true,
        async json() {
          return mockIbptBody;
        },
      };
    });

    await consultarProdutoIbpt({
      token: 'tok-test',
      cnpj: '01858368000158',
      codigoNcm: '22021000',
      uf: 'RJ',
      ex: '0',
      descricao: 'Refrigerante',
      unidadeMedida: 'UN',
      valor: '10.00',
      gtin: 'SEM GTIN',
    });

    assert.equal(capturedInit?.headers?.Accept, 'application/json');
    assert.match(String(capturedInit?.headers?.['User-Agent'] || ''), /Mozilla/);
  });

  it('isIbptOfflineError detecta timeout e fetch failed', () => {
    assert.equal(isIbptOfflineError(new Error('IBPT_TIMEOUT')), true);
    assert.equal(isIbptOfflineError(new Error('IBPT_FETCH_FAILED: fetch failed')), true);
    assert.equal(isIbptOfflineError(new Error('IBPT_HTTP_401')), false);
  });

  it('resolveIbptFallbackAliquotas usa capítulo 22 com 13.45% + 18%', () => {
    const rates = resolveIbptFallbackAliquotas('22021000');
    assert.equal(rates.nacional, 13.45);
    assert.equal(rates.estadual, 18);
    assert.equal(rates.estimated, true);
    assert.equal(rates.cacheLayer, 'fallback');
  });

  it('resolveIbptFallbackAliquotas usa default para capítulo desconhecido', () => {
    const rates = resolveIbptFallbackAliquotas('99999999');
    assert.equal(rates.nacional, 13.45);
    assert.equal(rates.estadual, 12);
  });

  it('consultarProdutoIbpt usa cache em memória na segunda chamada', async () => {
    let calls = 0;
    __setFetchImplForTests(async () => {
      calls += 1;
      return {
        ok: true,
        async json() {
          return mockIbptBody;
        },
      };
    });

    const params = {
      token: 'tok-test',
      cnpj: '01858368000158',
      codigoNcm: '33333333',
      uf: 'SP',
      ex: '0',
      descricao: 'Cerveja',
      unidadeMedida: 'UN',
      valor: '10.00',
      gtin: 'SEM GTIN',
    };

    const first = await consultarProdutoIbpt(params);
    const second = await consultarProdutoIbpt(params);

    assert.equal(first.nacional, 13.45);
    assert.equal(first.cacheLayer, 'api');
    assert.equal(second.cacheLayer, 'memory');
    assert.equal(calls, 1);
  });
});
