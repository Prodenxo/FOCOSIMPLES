import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import {
  MEI_GUIDE_INTEGRATION_SERPRO,
  MEI_GUIDE_SERPRO_UNAVAILABLE
} from '../src/constants/mei-guide-error-codes.js';
import {
  __resetAuthProcuradorStateForTests,
  __setHttpClientsForTests
} from '../src/services/gestao/authProcurador.service.js';

const SERPRO_STUB_BASE = 'https://serpro-stub.example';
const SERPRO_STUB_OAUTH = `${SERPRO_STUB_BASE}/oauth/token`;

let savedSerproApiBase;
let savedSerproOauthUrl;

test.beforeEach(() => {
  savedSerproApiBase = env.SERPRO_API_BASE_URL;
  savedSerproOauthUrl = env.SERPRO_OAUTH_TOKEN_URL;
  env.SERPRO_API_BASE_URL = SERPRO_STUB_BASE;
  env.SERPRO_OAUTH_TOKEN_URL = SERPRO_STUB_OAUTH;
  __resetAuthProcuradorStateForTests();
});

test.afterEach(() => {
  env.SERPRO_API_BASE_URL = savedSerproApiBase;
  env.SERPRO_OAUTH_TOKEN_URL = savedSerproOauthUrl;
  __resetAuthProcuradorStateForTests();
});

test('emitirServico: Serpro 500 mapeia para HttpError 503 e errors.code MEI_GUIDE_SERPRO_UNAVAILABLE', async () => {
  __setHttpClientsForTests({
    noMtls: true,
    fetchFn: async (url) => {
      const u = String(url);
      if (u.includes('/Emitir')) {
        return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(
        JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  });

  const { emitirServico } = await import('../src/services/gestao/emitir.service.js');

  await assert.rejects(
    () =>
      emitirServico({
        contratanteNumero: '12345678000199',
        autorPedidoNumero: '12345678000199',
        contribuinteNumero: '12345678000199',
        idSistema: 'PGMEI',
        idServico: 'GERARDASPDF21',
        dados: { periodoApuracao: '202401' }
      }),
    (err) => {
      assert.equal(err.status, 503);
      assert.ok(String(err.message).includes('Receita Federal'));
      assert.ok(err.errors);
      assert.equal(err.errors.code, MEI_GUIDE_SERPRO_UNAVAILABLE);
      assert.equal(err.errors.integration, MEI_GUIDE_INTEGRATION_SERPRO);
      assert.equal(err.errors.upstreamStatus, 500);
      return true;
    }
  );
});

test('emitirServico: Serpro 400 permanece badRequest 400', async () => {
  __setHttpClientsForTests({
    noMtls: true,
    fetchFn: async (url) => {
      const u = String(url);
      if (u.includes('/Emitir')) {
        return new Response(JSON.stringify({ message: 'Rejeitado' }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(
        JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  });

  const { emitirServico } = await import('../src/services/gestao/emitir.service.js');

  await assert.rejects(
    () =>
      emitirServico({
        contratanteNumero: '12345678000199',
        autorPedidoNumero: '12345678000199',
        contribuinteNumero: '12345678000199',
        idSistema: 'PGMEI',
        idServico: 'GERARDASPDF21',
        dados: { periodoApuracao: '202401' }
      }),
    (err) => {
      assert.equal(err.status, 400);
      return true;
    }
  );
});
