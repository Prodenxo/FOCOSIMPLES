import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'super-secret-plugnotas-key';
process.env.PLUGNOTAS_WEBHOOK_TOKEN = process.env.PLUGNOTAS_WEBHOOK_TOKEN || 'test-plugnotas-webhook-token';

const createJsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'Bad Request',
  headers: { get: () => 'application/json' },
  json: async () => payload
});

const createCidadePreflightResponse = () => createJsonResponse(200, {
  padraoNacional: { producao: true, homologacao: false },
  login: { producao: false, homologacao: false },
  senha: { producao: false, homologacao: false }
});

test('logPlugnotasEmpresaIbgeTable400: payload estruturado sem CNPJ completo nem payload JSON', async () => {
  const { logPlugnotasEmpresaIbgeTable400 } = await import(
    '../src/services/plugnotas/plugnotas-empresa-ibge-table-400-log.js'
  );

  const lines = [];
  const origInfo = console.info;
  console.info = (label, payload) => {
    lines.push({ label, payload });
  };

  try {
    logPlugnotasEmpresaIbgeTable400({
      method: 'POST',
      path: '/empresa',
      body: {
        cpfCnpj: '17422651000172',
        endereco: { codigoCidade: '3550308' }
      }
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].label, '[plugnotas] empresa 400 ibge table');
    const p = lines[0].payload;
    assert.equal(p.tag, 'plugnotas_empresa_400_ibge_table');
    assert.equal(p.kind, 'ibge_table');
    assert.equal(p.method, 'POST');
    assert.equal(p.path, '/empresa');
    assert.equal(p.codigoCidadeLen, 7);
    assert.match(p.cpfCnpj, /^\d{2}\*\*\*\d{2}$/);
    assert.ok(!p.cpfCnpj.includes('17422651000172'));
    assert.ok(!JSON.stringify(p).includes('3550308'));
  } finally {
    console.info = origInfo;
  }
});

test('logPlugnotasEmpresaIbgeTable400: PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG=off não escreve console.info', async () => {
  const prev = process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;
  process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG = 'off';

  const { logPlugnotasEmpresaIbgeTable400 } = await import(
    '../src/services/plugnotas/plugnotas-empresa-ibge-table-400-log.js'
  );

  const lines = [];
  const origInfo = console.info;
  console.info = (label, payload) => {
    lines.push({ label, payload });
  };

  try {
    logPlugnotasEmpresaIbgeTable400({
      method: 'POST',
      path: '/empresa',
      body: {
        cpfCnpj: '17422651000172',
        endereco: { codigoCidade: '3550308' }
      }
    });
    assert.equal(lines.length, 0);
  } finally {
    process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG = prev;
    console.info = origInfo;
  }
});

test('produção: POST /empresa 400 com mensagem IBGE-tabela regista console.info estruturado (sem PLUGNOTAS_DEBUG)', async () => {
  const prevN = process.env.NODE_ENV;
  const prevD = process.env.PLUGNOTAS_DEBUG;
  const prevIbgeLog = process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;
  process.env.NODE_ENV = 'production';
  delete process.env.PLUGNOTAS_DEBUG;
  delete process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;

  const infoLines = [];
  const errLines = [];
  const origInfo = console.info;
  const origErr = console.error;
  console.info = (a, b) => {
    infoLines.push(typeof b === 'object' ? b : {});
  };
  console.error = (...a) => {
    errLines.push(a.map((x) => (typeof x === 'string' ? x : '')).join(' '));
  };
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(400, {
      message:
        'Falha: fields.endereco.codigoIBGECidade não consta na tabela de cidades do IBGE.'
    });
  };

  try {
    const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'X',
        endereco: { codigoCidade: '1234567' }
      }),
      (e) => e.status === 400
    );
    assert.equal(infoLines.length, 1);
    assert.equal(infoLines[0].tag, 'plugnotas_empresa_400_ibge_table');
    assert.equal(infoLines[0].codigoCidadeLen, 7);
    assert.ok(!errLines.some((l) => l.includes('[plugnotas empresa cadastro]')));
  } finally {
    process.env.NODE_ENV = prevN;
    if (prevD === undefined) delete process.env.PLUGNOTAS_DEBUG;
    else process.env.PLUGNOTAS_DEBUG = prevD;
    if (prevIbgeLog === undefined) delete process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;
    else process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG = prevIbgeLog;
    console.info = origInfo;
    console.error = origErr;
    global.fetch = originalFetch;
  }
});

test('produção: PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG=off suprime log ibge table no cadastro empresa', async () => {
  const prevN = process.env.NODE_ENV;
  const prevD = process.env.PLUGNOTAS_DEBUG;
  const prevIbgeLog = process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;
  process.env.NODE_ENV = 'production';
  delete process.env.PLUGNOTAS_DEBUG;
  process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG = 'off';

  const infoLines = [];
  const origInfo = console.info;
  console.info = (a, b) => {
    infoLines.push(typeof b === 'object' ? b : {});
  };
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(400, {
    message:
      'Falha: fields.endereco.codigoIBGECidade não consta na tabela de cidades do IBGE.'
  });

  try {
    const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'X',
        endereco: { codigoCidade: '1234567' }
      }),
      (e) => e.status === 400
    );
    assert.equal(infoLines.filter((p) => p?.tag === 'plugnotas_empresa_400_ibge_table').length, 0);
  } finally {
    process.env.NODE_ENV = prevN;
    if (prevD === undefined) delete process.env.PLUGNOTAS_DEBUG;
    else process.env.PLUGNOTAS_DEBUG = prevD;
    if (prevIbgeLog === undefined) delete process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG;
    else process.env.PLUGNOTAS_EMPRESA_IBGE_TABLE_LOG = prevIbgeLog;
    console.info = origInfo;
    global.fetch = originalFetch;
  }
});

test('produção: 400 sem heurística IBGE não regista ibge table info', async () => {
  const prevN = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.PLUGNOTAS_DEBUG;

  const infoLines = [];
  const origInfo = console.info;
  console.info = (a, b) => {
    infoLines.push(b);
  };
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(400, { message: 'Razão social inválida.' });

  try {
    const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'X'
      }),
      (e) => e.status === 400
    );
    assert.equal(infoLines.filter((p) => p?.tag === 'plugnotas_empresa_400_ibge_table').length, 0);
  } finally {
    process.env.NODE_ENV = prevN;
    console.info = origInfo;
    global.fetch = originalFetch;
  }
});
