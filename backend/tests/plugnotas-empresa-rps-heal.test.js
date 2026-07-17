import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancePlugnotasNfseRpsAfterEmit,
  applyPlugnotasNfseEmitRpsFromEmpresaConfig,
  emitNfseWithPlugnotasRpsHeal,
  empresaPlugnotasTemRpsCadastrado,
  ensureEmpresaPlugnotasRpsForNfseEmit,
  isNfseE0014FromPlugnotasResponse,
  isNfseRejectedPlugnotasResponse,
  isNfseRpsDuplicateRejectionLoose,
  queryMaxRpsNumeroFromPlugnotasPeriodo,
  readPlugnotasNfseNextRpsFromEmpresa,
  readRpsFromNfseEmitPayload,
  readRpsNumeroFromNfseHistoryRow,
  readRpsNumeroFromNfsePlugnotasBody,
  resolveAndApplySafeNfseRpsBeforeEmit,
  resolveNextNfseRpsAfterFailure,
  resolveNextNfseRpsFromSources,
  resolveNextNfseRpsNumero,
  resolveNfseRpsLocalMaxFromHistory,
  syncPlugnotasNfseRpsBeforeEmit
} from '../src/services/plugnotas/plugnotas-empresa-rps-heal.js';

test('resolveNextNfseRpsNumero prioriza histórico local; PlugNotas só sem histórico', () => {
  assert.equal(resolveNextNfseRpsNumero(5, 7), 8);
  assert.equal(resolveNextNfseRpsNumero(10, 3), 4);
  assert.equal(resolveNextNfseRpsNumero(1, null), 1);
});

test('readRpsFromNfseEmitPayload lê numeracao do payload de emissão', () => {
  assert.deepEqual(
    readRpsFromNfseEmitPayload({ rps: { lote: 1, numeracao: [{ serie: '1', numero: 12 }] } }),
    { serie: '1', numero: 12, lote: 1 }
  );
});

test('resolveNfseRpsLocalMaxFromHistory usa só o maior número conhecido', () => {
  assert.equal(resolveNfseRpsLocalMaxFromHistory({ maxKnownNumero: 45 }), 45);
  assert.equal(resolveNfseRpsLocalMaxFromHistory({ maxKnownNumero: 0 }), null);
});

test('readRpsNumeroFromNfsePlugnotasBody lê resposta NFS-e Nacional rejeitada (DPS 34)', () => {
  const body = {
    rps: { lote: 1, serie: '1', numero: 34 },
    dps: { id: 'DPS330455726580558300017300001000000000000034', numero: 34, serie: '1' },
    retorno: {
      mensagemRetorno: 'E0014 - Conjunto de Série, Número, Código do Município Emissor...',
      situacao: 'REJEITADA',
    },
    status: 'REJEITADO',
  };
  assert.equal(readRpsNumeroFromNfsePlugnotasBody(body), 34);
  assert.equal(isNfseE0014FromPlugnotasResponse(body), true);
});

test('readRpsNumeroFromNfsePlugnotasBody lê resposta em array com rps flat e dps (Postman)', () => {
  const postmanBody = [{
    rps: { lote: 1, serie: '1', numero: 45 },
    dps: { id: 'DPS330455726580558300017300001000000000000045', numero: 45, serie: '1' },
    retorno: {
      mensagemRetorno: 'E0014 - Conjunto de Série, Número...',
      situacao: 'REJEITADA'
    }
  }];
  assert.equal(readRpsNumeroFromNfsePlugnotasBody(postmanBody), 45);
});

test('readRpsNumeroFromNfseHistoryRow lê número da resposta PlugNotas em array', () => {
  assert.equal(
    readRpsNumeroFromNfseHistoryRow({
      payload_json: {},
      response_json: [{ rps: { serie: '1', numero: 45, lote: 1 } }]
    }),
    45
  );
});

test('resolveNextNfseRpsNumero após E0014 no 45 deve emitir 46', () => {
  assert.equal(resolveNextNfseRpsNumero(43, 45), 46);
  assert.equal(resolveNextNfseRpsNumero(45, 45), 46);
});

test('resolveNextNfseRpsFromSources usa histórico real + 1; empresa à frente não pula DPS', () => {
  assert.equal(resolveNextNfseRpsFromSources({ empresaNumero: 34, localMaxNumero: 35, periodoMaxNumero: 36 }), 37);
  assert.equal(resolveNextNfseRpsFromSources({ empresaNumero: 34, localMaxNumero: 35, periodoMaxNumero: null }), 36);
  assert.equal(resolveNextNfseRpsFromSources({ empresaNumero: 92, localMaxNumero: 90, periodoMaxNumero: 90 }), 91);
  assert.equal(resolveNextNfseRpsFromSources({ empresaNumero: 5, localMaxNumero: null, periodoMaxNumero: null }), 5);
  assert.equal(resolveNextNfseRpsFromSources({ empresaNumero: null, localMaxNumero: null, periodoMaxNumero: null }), 1);
});

test('resolveNextNfseRpsAfterFailure sempre avança após número rejeitado (caso 34)', () => {
  assert.equal(resolveNextNfseRpsNumero(34, 33), 34);
  assert.equal(resolveNextNfseRpsAfterFailure(34, 33, null), 35);
  assert.equal(resolveNextNfseRpsAfterFailure(34, 33, 36), 37);
  assert.equal(resolveNextNfseRpsAfterFailure(34, 40, 33), 41);
});

test('syncPlugnotasNfseRpsBeforeEmit faz PATCH quando contador PlugNotas está atrás', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { ativo: true, config: { rps: { numeracao: [{ serie: '1', numero: 5 }], lote: 1 } } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    await syncPlugnotasNfseRpsBeforeEmit('12.345.678/0001-99', { serie: '1', numero: 18, lote: 1 });
    const patchCall = calls.find((c) => c.options.method === 'PATCH');
    assert.ok(patchCall);
    const body = JSON.parse(patchCall.options.body);
    assert.equal(body.nfse.config.rps.numero, 18);
    assert.equal(body.nfse.config.rps.serie, '1');
    assert.equal('numeracao' in body.nfse.config.rps, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('syncPlugnotasNfseRpsBeforeEmit não reenvia credenciais prefeitura no PATCH de RPS', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/empresa/12345678000199') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  const empresaComPrefeitura = {
    cpfCnpj: '12345678000199',
    nfse: {
      ativo: true,
      config: {
        producao: true,
        rps: { serie: '1', numero: 5, lote: 1 },
        prefeitura: { login: 'user', senha: 'secret' },
      },
    },
  };

  try {
    await syncPlugnotasNfseRpsBeforeEmit(
      '12.345.678/0001-99',
      { serie: '1', numero: 115, lote: 1 },
      empresaComPrefeitura,
    );
    const patchCall = calls.find((c) => c.options.method === 'PATCH');
    assert.ok(patchCall);
    const body = JSON.parse(patchCall.options.body);
    assert.equal(body.nfse.config.rps.numero, 115);
    assert.equal(body.nfse.config.prefeitura, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('readRpsNumeroFromNfseHistoryRow lê número do payload ou da resposta PlugNotas', () => {
  assert.equal(
    readRpsNumeroFromNfseHistoryRow({
      payload_json: { rps: { lote: 1, numeracao: [{ serie: '1', numero: 9 }] } }
    }),
    9
  );
  assert.equal(
    readRpsNumeroFromNfseHistoryRow({
      payload_json: {},
      response_json: { rps: { lote: 1, numeracao: [{ serie: '1', numero: 11 }] } }
    }),
    11
  );
  assert.equal(readRpsNumeroFromNfseHistoryRow({}), null);
});

test('applyPlugnotasNfseEmitRpsFromEmpresaConfig usa histórico local se GET empresa falhar', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({ notas: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error('plugnotas indisponível');
  };

  try {
    const payload = { idIntegracao: 'x' };
    await applyPlugnotasNfseEmitRpsFromEmpresaConfig(payload, '12.345.678/0001-99', {
      localMaxRpsNumero: 12
    });
    assert.deepEqual(payload.rps, {
      lote: 1,
      numeracao: [{ serie: '1', numero: 13 }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('applyPlugnotasNfseEmitRpsFromEmpresaConfig avança número com localMaxRpsNumero', async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({ notas: [{ numero: 88 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { config: { rps: { numeracao: [{ serie: '1', numero: 5 }], lote: 1 } } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    const payload = { idIntegracao: 'x' };
    await applyPlugnotasNfseEmitRpsFromEmpresaConfig(payload, '12.345.678/0001-99', {
      localMaxRpsNumero: 7
    });
    assert.deepEqual(payload.rps, {
      lote: 1,
      numeracao: [{ serie: '1', numero: 89 }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('advancePlugnotasNfseRpsAfterEmit faz PATCH quando contador PlugNotas está atrás', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { ativo: true, config: { rps: { numeracao: [{ serie: '1', numero: 5 }], lote: 1 } } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    await advancePlugnotasNfseRpsAfterEmit('12.345.678/0001-99', { serie: '1', numero: 8, lote: 1 });
    const patchCall = calls.find((c) => c.options.method === 'PATCH');
    assert.ok(patchCall);
    const body = JSON.parse(patchCall.options.body);
    assert.equal(body.nfse.config.rps.numero, 9);
    assert.equal(body.rps.numeracao[0].numero, 9);
    assert.equal('numeracao' in body.nfse.config.rps, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('readPlugnotasNfseNextRpsFromEmpresa lê numeracao em nfse.config.rps', () => {
  assert.deepEqual(
    readPlugnotasNfseNextRpsFromEmpresa({
      cpfCnpj: '12345678000199',
      nfse: { config: { rps: { numeracao: [{ serie: '1', numero: 4 }], lote: 1 } } }
    }),
    { serie: '1', numero: 4, lote: 1 }
  );
});

test('applyPlugnotasNfseEmitRpsFromEmpresaConfig injeta rps explícito quando ausente', async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({ notas: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { config: { rps: { numeracao: [{ serie: '1', numero: 5 }], lote: 1 } } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    const payload = { idIntegracao: 'x' };
    await applyPlugnotasNfseEmitRpsFromEmpresaConfig(payload, '12.345.678/0001-99');
    assert.deepEqual(payload.rps, {
      lote: 1,
      numeracao: [{ serie: '1', numero: 5 }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('applyPlugnotasNfseEmitRpsFromEmpresaConfig substitui rps obsoleto pelo próximo número seguro', async () => {
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({ notas: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { config: { rps: { numeracao: [{ serie: '1', numero: 5 }], lote: 1 } } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    const payload = { rps: { serie: '1', numero: 9, lote: 1 } };
    await applyPlugnotasNfseEmitRpsFromEmpresaConfig(payload, '12.345.678/0001-99', {
      localMaxRpsNumero: 7
    });
    assert.deepEqual(payload.rps, {
      lote: 1,
      numeracao: [{ serie: '1', numero: 8 }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresaPlugnotasTemRpsCadastrado reconhece rps válido no GET empresa', () => {
  assert.equal(
    empresaPlugnotasTemRpsCadastrado({
      cpfCnpj: '12345678000199',
      rps: { lote: 1, numeracao: [{ numero: 1, serie: '1' }] }
    }),
    true
  );
  assert.equal(
    empresaPlugnotasTemRpsCadastrado({
      cpfCnpj: '12345678000199',
      rps: { lote: 1 }
    }),
    false
  );
});

test('ensureEmpresaPlugnotasRpsForNfseEmit não faz PATCH quando numeracao já existe em nfse.config.rps', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: {
          ativo: true,
          config: { rps: { lote: 1, numeracao: [{ serie: '1', numero: 4 }] } }
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    await ensureEmpresaPlugnotasRpsForNfseEmit('12.345.678/0001-99');
    assert.equal(calls.filter((c) => c.options.method === 'PATCH').length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('ensureEmpresaPlugnotasRpsForNfseEmit faz PATCH só quando rps ausente', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/empresa/12345678000199') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '12345678000199',
        nfse: { ativo: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/12345678000199') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    await ensureEmpresaPlugnotasRpsForNfseEmit('12.345.678/0001-99');
    const patchCall = calls.find((c) => c.options.method === 'PATCH');
    assert.ok(patchCall);
    const body = JSON.parse(patchCall.options.body);
    assert.deepEqual(body.rps, {
      lote: 1,
      numeracao: [{ numero: 1, serie: '1' }]
    });
    assert.deepEqual(body.nfse.config.rps, { serie: '1', numero: 1, lote: 1 });
  } finally {
    global.fetch = originalFetch;
  }
});

test('queryMaxRpsNumeroFromPlugnotasPeriodo pagina até hashProximaPagina null', async () => {
  const originalFetch = global.fetch;
  let page = 0;

  global.fetch = async (url) => {
    if (!String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({}), { status: 500 });
    }
    page += 1;
    if (page === 1) {
      return new Response(JSON.stringify({
        hashProximaPagina: 'next-page',
        notas: [{ numero: 55 }, { numero: 88 }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      hashProximaPagina: null,
      notas: [{ numero: 12 }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const max = await queryMaxRpsNumeroFromPlugnotasPeriodo('65.805.583/0001-73');
    assert.equal(max, 88);
  } finally {
    global.fetch = originalFetch;
  }
});

test('resolveAndApplySafeNfseRpsBeforeEmit usa max 40 → próximo 41 (caso Yasmim)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({
        notas: [
          { dps: { numero: 40, serie: '1' }, status: 'REJEITADO' },
          { dps: { numero: 38, serie: '1' }, status: 'REJEITADO' },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/65805583000173') && options.method === 'GET') {
      return new Response(JSON.stringify({
        cpfCnpj: '65805583000173',
        nfse: { config: { rps: { serie: '1', numero: 38, lote: 1 } } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/empresa/') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  try {
    const payload = { idIntegracao: 'teste' };
    const plan = await resolveAndApplySafeNfseRpsBeforeEmit(payload, '65805583000173', {
      localMaxRpsNumero: 40,
      plugnotasApiMaxRpsNumero: 40,
      skipPlugnotasPeriodoQuery: true,
    });
    assert.equal(plan?.safeNext, 41);
    assert.equal(payload.rps.numeracao[0].numero, 41);
  } finally {
    global.fetch = originalFetch;
  }
});

test('isNfseRpsDuplicateRejectionLoose detecta JSON real rejeitado DPS 36', () => {
  const body = {
    rps: { numero: 36, serie: '1', lote: 1 },
    dps: { numero: 36, serie: '1' },
    retorno: {
      mensagemRetorno: 'E0014 - Conjunto de Série, Número, Código do Município Emissor...',
      situacao: 'REJEITADA',
    },
    status: 'REJEITADO',
  };
  assert.equal(isNfseRpsDuplicateRejectionLoose(body), true);
  assert.equal(isNfseRejectedPlugnotasResponse(body, ''), true);
});

test('isNfseE0014FromPlugnotasResponse reconhece mensagem humanizada de numeração repetida', () => {
  assert.equal(
    isNfseE0014FromPlugnotasResponse({
      retorno: {
        mensagemRetorno: 'E0014: Conjunto de Série, Número, Código do Município Emissor...',
      },
    }),
    true,
  );
  assert.equal(
    isNfseE0014FromPlugnotasResponse({
      retorno: {
        mensagemRetorno: 'Numeração repetida (série + número da nota): combinação já foi usada',
      },
    }),
    true,
  );
});

test('emitNfseWithPlugnotasRpsHeal reenvia quando E0014 não traz número na resposta mas payload tem rps', async () => {
  const originalFetch = global.fetch;
  const emitCalls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/consultar/periodo')) {
      return new Response(JSON.stringify({ notas: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).includes('/empresa/') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  const adapter = {
    emitir: async (payload) => {
      emitCalls.push(payload);
      if (emitCalls.length === 1) {
        return [{
          retorno: {
            mensagemRetorno: 'Numeração repetida (série + número da nota): combinação já foi usada',
            situacao: 'REJEITADA',
          },
          status: 'REJEITADO',
        }];
      }
      return [{ status: 'PROCESSANDO', rps: { numero: 47, serie: '1', lote: 1 } }];
    },
  };

  try {
    const { response } = await emitNfseWithPlugnotasRpsHeal(
      adapter,
      {
        idIntegracao: 'teste-1',
        rps: { lote: 1, numeracao: [{ serie: '1', numero: 46 }] },
      },
      '65805583000173',
      () => 'teste-2',
    );
    assert.equal(emitCalls.length, 2);
    assert.equal(emitCalls[1].rps.numeracao[0].numero, 47);
    assert.equal(readRpsNumeroFromNfsePlugnotasBody(response), 47);
  } finally {
    global.fetch = originalFetch;
  }
});

test('emitNfseWithPlugnotasRpsHeal usa número do payload quando resposta E0014 não traz dps', async () => {
  const originalFetch = global.fetch;
  const emitCalls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/empresa/') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  const adapter = {
    emitir: async (payload) => {
      emitCalls.push(payload);
      if (emitCalls.length === 1) {
        return [{
          retorno: {
            mensagemRetorno: 'E0014 - Conjunto de Série, Número...',
            situacao: 'REJEITADA',
          },
          status: 'REJEITADO',
        }];
      }
      return [{ status: 'PROCESSANDO', rps: { numero: 56, serie: '1', lote: 1 } }];
    },
  };

  try {
    const { response } = await emitNfseWithPlugnotasRpsHeal(
      adapter,
      {
        idIntegracao: 'teste-1',
        rps: { lote: 1, numeracao: [{ serie: '1', numero: 55 }] },
      },
      '65805583000173',
      () => 'teste-2',
    );
    assert.equal(emitCalls.length, 2);
    assert.equal(emitCalls[1].rps.numeracao[0].numero, 56);
    assert.equal(readRpsNumeroFromNfsePlugnotasBody(response), 56);
  } finally {
    global.fetch = originalFetch;
  }
});

test('emitNfseWithPlugnotasRpsHeal reenvia com próximo DPS após E0014', async () => {
  const originalFetch = global.fetch;
  const emitCalls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/empresa/') && options.method === 'PATCH') {
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected' }), { status: 500 });
  };

  const adapter = {
    emitir: async (payload) => {
      emitCalls.push(payload);
      if (emitCalls.length === 1) {
        return [{
          dps: { numero: 55 },
          retorno: {
            mensagemRetorno: 'E0014 - Conjunto de Série, Número...',
            situacao: 'REJEITADA'
          },
          status: 'REJEITADO'
        }];
      }
      return [{
        dps: { numero: 56 },
        status: 'PROCESSANDO'
      }];
    }
  };

  try {
    const initial = {
      idIntegracao: 'teste-1',
      rps: { lote: 1, numeracao: [{ serie: '1', numero: 55 }] }
    };
    const { response, emitPayload } = await emitNfseWithPlugnotasRpsHeal(
      adapter,
      initial,
      '65805583000173',
      () => 'teste-2'
    );
    assert.equal(emitCalls.length, 2);
    assert.deepEqual(emitCalls[1].rps, {
      lote: 1,
      numeracao: [{ serie: '1', numero: 56 }]
    });
    assert.equal(emitPayload.idIntegracao, 'teste-2');
    assert.equal(readRpsNumeroFromNfsePlugnotasBody(response), 56);
  } finally {
    global.fetch = originalFetch;
  }
});
