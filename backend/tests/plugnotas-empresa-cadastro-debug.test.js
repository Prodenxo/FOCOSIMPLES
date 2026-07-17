import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'super-secret-plugnotas-key';

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

test('isEmpresaCadastroPlugnotasPath reconhece POST e PATCH empresa', async () => {
  const { isEmpresaCadastroPlugnotasPath } = await import(
    '../src/services/plugnotas/plugnotas-empresa-cadastro-debug.js'
  );
  assert.equal(isEmpresaCadastroPlugnotasPath('/empresa'), true);
  assert.equal(isEmpresaCadastroPlugnotasPath('/empresa/123'), true);
  assert.equal(isEmpresaCadastroPlugnotasPath('/nfse'), false);
});

test('em produção sem PLUGNOTAS_DEBUG não loga payload 400 cadastro empresa', async () => {
  const prevN = process.env.NODE_ENV;
  const prevD = process.env.PLUGNOTAS_DEBUG;
  process.env.NODE_ENV = 'production';
  delete process.env.PLUGNOTAS_DEBUG;

  const lines = [];
  const origErr = console.error;
  console.error = (...a) => {
    lines.push(a.map((x) => (typeof x === 'string' ? x : '')).join(' '));
  };
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(400, { message: 'Falha' });

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
    assert.ok(!lines.some((l) => l.includes('[plugnotas empresa cadastro]')));
  } finally {
    process.env.NODE_ENV = prevN;
    if (prevD === undefined) delete process.env.PLUGNOTAS_DEBUG;
    else process.env.PLUGNOTAS_DEBUG = prevD;
    console.error = origErr;
    global.fetch = originalFetch;
  }
});

test('fora de produção, POST /empresa 400 loga JSON redigido sem CNPJ completo nem senha', async () => {
  const prevN = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  const lines = [];
  const origErr = console.error;
  console.error = (...a) => {
    lines.push(a.map((x) => (typeof x === 'string' ? x : '')).join(' '));
  };
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(400, { message: 'Falha validação' });
  };

  try {
    const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'id-certificado-longo',
        razaoSocial: 'Empresa',
        senha: 'nao-pode-vazar',
        endereco: {
          codigoCidade: '3550308',
          estado: 'SP',
          logradouro: 'Rua A',
          numero: '1',
          bairro: 'Centro',
          cep: '01000000'
        }
      }),
      (e) => e.status === 400
    );
    const blob = lines.join('\n');
    assert.match(blob, /\[plugnotas empresa cadastro\].*POST \/empresa.*400 request payload \(redacted\)/);
    assert.match(blob, /17\*\*\*72/);
    assert.ok(!blob.includes('17422651000172'));
    assert.ok(!blob.includes('nao-pode-vazar'));
    assert.ok(!blob.includes('super-secret-plugnotas-key'));
    assert.match(blob, /razaoSocial.*\*\*\*/);
    assert.ok(!blob.includes('"razaoSocial":"Empresa"'));
  } finally {
    process.env.NODE_ENV = prevN;
    console.error = origErr;
    global.fetch = originalFetch;
  }
});

test('isPlugnotasDebugExplicitlyEnabled aceita TRUE em maiúsculas', async () => {
  const prev = process.env.PLUGNOTAS_DEBUG;
  process.env.PLUGNOTAS_DEBUG = 'TRUE';
  const { isPlugnotasDebugExplicitlyEnabled } = await import('../src/services/plugnotas/plugnotas-debug-env.js');
  try {
    assert.equal(isPlugnotasDebugExplicitlyEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.PLUGNOTAS_DEBUG;
    else process.env.PLUGNOTAS_DEBUG = prev;
  }
});

test('applyEmpresaCadastroPiiMaskForLog mascara endereco aninhado', async () => {
  const { applyEmpresaCadastroPiiMaskForLog } = await import(
    '../src/services/plugnotas/plugnotas-empresa-cadastro-debug.js'
  );
  const out = applyEmpresaCadastroPiiMaskForLog({
    razaoSocial: 'ACME LTDA',
    endereco: { logradouro: 'Rua das Flores', cep: '01310100' }
  });
  assert.equal(out.razaoSocial, 'AC***A');
  assert.equal(out.endereco.logradouro, 'Ru***s');
  assert.match(out.endereco.cep, /01\*\*\*00/);
});

test('redactPayload exportado mascara cnpj aninhado e senha', async () => {
  const { redactPayload } = await import('../src/services/plugnotas/plugnotas-emit-400-log.js');
  const out = redactPayload({
    cpfCnpj: '17422651000172',
    senha: 'x',
    endereco: { cnpj: '17422651000172' }
  });
  const s = JSON.stringify(out);
  assert.match(s, /17\*\*\*72/);
  assert.ok(!s.includes('17422651000172'));
  assert.match(s, /\[redacted\]/);
});
