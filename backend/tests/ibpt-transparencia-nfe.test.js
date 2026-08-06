import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIbptComplementarFieldsToPayload,
  applyIbptTransparenciaToNfePayload,
  buildInformacoesComplementaresIbpt,
  mergeInformacoesComplementares,
} from '../src/lib/ibpt-transparencia-nfe.js';
import {
  __resetIbptCacheForTests,
  __setFetchImplForTests,
  __setIbptDbCacheEnabledForTests,
} from '../src/services/ibpt.service.js';

describe('ibpt-transparencia-nfe', () => {
  beforeEach(() => {
    __resetIbptCacheForTests();
    __setIbptDbCacheEnabledForTests(false);
  });

  it('buildInformacoesComplementaresIbpt formata texto compacto com percentual', () => {
    const text = buildInformacoesComplementaresIbpt({
      totalTributos: 6.29,
      totalValorProdutos: 20,
      fonte: 'IBPT',
    });
    assert.match(text, /Val Aprox Tributos R\$ 6,29 \(31,45%\)/);
    assert.match(text, /Fonte: IBPT/);
  });

  it('mergeInformacoesComplementares concatena sem duplicar', () => {
    assert.equal(
      mergeInformacoesComplementares('Obs cliente.', 'Val Aprox Tributos R$ 1,00 (10,00%) Fonte: IBPT'),
      'Obs cliente. Val Aprox Tributos R$ 1,00 (10,00%) Fonte: IBPT',
    );
  });

  it('applyIbptComplementarFieldsToPayload preenche informacoesComplementares', () => {
    const out = applyIbptComplementarFieldsToPayload(
      { informacoesComplementares: 'Obs.' },
      'Val Aprox Tributos R$ 1,00 (10,00%) Fonte: IBPT',
    );
    assert.match(String(out.informacoesComplementares), /Val Aprox Tributos/);
    assert.match(String(out.informacoesComplementares), /Obs\./);
  });

  it('applyIbptTransparenciaToNfePayload preenche valorAproximadoTributos nos itens', async () => {
    __setFetchImplForTests(async () => ({
      ok: true,
      async json() {
        return {
          Nacional: 10,
          Estadual: 5,
          Importado: 0,
          Municipal: 0,
          Fonte: 'IBPT',
          Versao: '25.1.A',
        };
      },
    }));

    const payload = {
      emitente: {
        cpfCnpj: '01858368000158',
        endereco: { estado: 'SP' },
      },
      itens: [{
        codigo: '001',
        descricao: 'Agua',
        ncm: '22011000',
        cfop: '5102',
        unidadeComercial: 'UN',
        quantidade: 2,
        valorUnitario: 10,
        valor: 20,
        tributos: {
          icms: { origem: '0', cst: '102' },
          pis: { cst: '49' },
          cofins: { cst: '49' },
        },
      }],
    };

    const { payload: out, ibpt } = await applyIbptTransparenciaToNfePayload(payload, {
      token: 'tok-test',
    });

    assert.equal(out.itens[0].tributos.valorAproximadoTributos, 3);
    assert.match(String(out.informacoesComplementares), /Val Aprox Tributos/);
    assert.equal(ibpt.status, 'ok');
  });

  it('applyIbptTransparenciaToNfePayload usa estimativa local quando IBPT offline', async () => {
    __setFetchImplForTests(async () => {
      throw new Error('IBPT_TIMEOUT');
    });

    const payload = {
      emitente: { cpfCnpj: '01858368000158', endereco: { estado: 'RJ' } },
      itens: [{
        ncm: '22021000',
        descricao: 'Refrigerante',
        valor: 10,
        tributos: { icms: { origem: '0' } },
      }],
    };

    const { payload: out, ibpt } = await applyIbptTransparenciaToNfePayload(payload, { token: 'tok-test' });

    assert.equal(out.itens[0].tributos.valorAproximadoTributos, 3.15);
    assert.match(String(out.informacoesComplementares), /Val Aprox Tributos R\$ 3,15 \(31,50%\)/);
    assert.match(String(out.informacoesComplementares), /Fonte: IBPT/);
    assert.equal(ibpt.status, 'offline_estimated');
    assert.equal(ibpt.itemsEstimated, 1);
    assert.equal(ibpt.totalTributos, 3.15);
  });

  it('applyIbptTransparenciaToNfePayload não usa estimativa em erro de autenticação', async () => {
    __setFetchImplForTests(async () => ({
      ok: false,
      status: 401,
    }));

    const payload = {
      emitente: { cpfCnpj: '01858368000158', endereco: { estado: 'SP' } },
      itens: [{
        ncm: '22021000',
        descricao: 'Refrigerante',
        valor: 10,
        tributos: { icms: { origem: '0' } },
      }],
    };

    const { payload: out, ibpt } = await applyIbptTransparenciaToNfePayload(payload, { token: 'tok-test' });
    assert.equal(out.itens[0].tributos?.valorAproximadoTributos, undefined);
    assert.equal(ibpt.status, 'auth_error');
    assert.ok(ibpt.itemsFailed >= 1);
  });
});
