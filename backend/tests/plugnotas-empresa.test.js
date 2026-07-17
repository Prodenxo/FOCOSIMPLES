import test from 'node:test';
import assert from 'node:assert/strict';

import { HttpError } from '../src/utils/errors.js';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';
process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL || 'off';

const createJsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 409 ? 'Conflict' : 'Error',
  headers: { get: () => 'application/json' },
  json: async () => payload
});

/** Resposta erro com corpo HTML (proxy/gateway) — `parseResponsePayload` usa `text()`. */
const createHtmlErrorResponse = (status, htmlBody) => ({
  ok: false,
  status,
  statusText: status === 502 ? 'Bad Gateway' : 'Error',
  headers: {
    get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
  },
  json: async () => {
    throw new SyntaxError('not json');
  },
  text: async () => htmlBody
});

const buildEmpresaEnderecoValido = (overrides = {}) => ({
  codigoCidade: '3550308',
  estado: 'SP',
  uf: 'SP',
  logradouro: 'Rua A',
  numero: '1',
  bairro: 'Centro',
  cep: '01000000',
  ...overrides
});

const createCidadePreflightResponse = (overrides = {}) =>
  createJsonResponse(200, {
    padraoNacional: { producao: true, homologacao: false },
    login: { producao: false, homologacao: false },
    senha: { producao: false, homologacao: false },
    ...overrides
  });

const assertOfficialNfseContract = (nfse) => {
  assert.equal(nfse?.config?.nfseNacional, true);
  assert.equal(nfse?.config?.consultaNfseNacional, true);
  assert.equal(Object.prototype.hasOwnProperty.call(nfse || {}, 'nacional'), false);
};

test('empresa service valida payload obrigatório', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');

  await assert.rejects(
    () => cadastrarEmpresaPlugNotas(null),
    /Payload da empresa é obrigatório/
  );
  await assert.rejects(
    () => cadastrarEmpresaPlugNotas({ cpfCnpj: '123', certificado: 'cert-1' }),
    /CNPJ da empresa deve ter 14 dígitos/
  );
  await assert.rejects(
    () => cadastrarEmpresaPlugNotas({ cpfCnpj: '17422651000172' }),
    /Certificado digital não localizado no PlugNotas/
  );
});

test('cadastrarEmpresaPlugNotas preserva e sanitiza rps válido do cliente no POST', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido(),
      rps: { lote: 99, numeracao: [{ numero: 9, serie: 'X' }] }
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.deepEqual(sent.rps, {
      lote: 99,
      numeracao: [{ numero: 9, serie: 'X' }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service cria empresa com POST /empresa', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/empresa$/);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(response.operation, 'created');
    assert.equal(response.cnpj, '17422651000172');
    assert.equal(response.runtimeDecision?.scenario, 'success_nacional');
    assert.equal(inferEmpresaCadastroScenario({ operation: response.operation }), 'success_nacional');
    const sent = JSON.parse(calls[0].options.body);
    assert.deepEqual(sent.rps, {
      lote: 1,
      numeracao: [{ numero: 1, serie: '1' }]
    });
    assert.ok(sent.nfce && typeof sent.nfce === 'object');
    assert.equal(sent.nfce.ativo, false);
    assert.equal(sent.nfe.ativo, false);
    assert.equal('config' in sent.nfce, false);
    assert.equal(sent.inscricaoEstadual, 'ISENTO');
    assertOfficialNfseContract(sent.nfse);
    assert.equal(
      Object.prototype.hasOwnProperty.call(sent.nfse?.config || {}, 'prefeitura'),
      false,
      'sem PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE não enviar prefeitura derivada (NFR-P0-REG-01)'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service bloqueia localmente quando endereco.codigoCidade está ausente antes do preflight', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createCidadePreflightResponse();
  };

  try {
    await assert.rejects(
      () =>
        cadastrarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          certificado: 'cert-1',
          razaoSocial: 'Empresa Teste',
          endereco: buildEmpresaEnderecoValido({ codigoCidade: undefined })
        }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'payload_contrato');
        assert.equal(err.errors?.runtimeDecision?.scenario, 'payload_contrato');
        assert.equal(err.errors?.runtimeDecision?.consultedMunicipio, false);
        assert.equal(err.errors?.runtimeDecision?.upstreamCallSkipped, true);
        return true;
      }
    );
    assert.equal(calls.length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service bloqueia município com login obrigatório já no preflight dinâmico', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: false, homologacao: false },
        login: { producao: true, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () =>
        cadastrarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          certificado: 'cert-1',
          razaoSocial: 'Empresa Teste',
          endereco: buildEmpresaEnderecoValido()
        }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'prefeitura_login_required_blocked');
        assert.equal(err.errors?.runtimeDecision?.scenario, 'prefeitura_login_required_blocked');
        assert.equal(err.errors?.runtimeDecision?.consultedMunicipio, true);
        assert.equal(err.errors?.runtimeDecision?.codigoIbge, '3550308');
        return true;
      }
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfse\/cidades\/3550308$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service FR-PFLNAT: IBGE 5002704 preflight híbrido (nacional+login) permite POST /empresa', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: true, homologacao: false },
        login: { producao: true, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido({ codigoCidade: '5002704' })
    });
    assert.equal(response.operation, 'created');
    assert.equal(response.runtimeDecision?.scenario, 'success_nacional');
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/nfse\/cidades\/5002704$/);
    assert.match(calls[1].url, /\/empresa$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('FR-ALNFB 1.1: auth municipal + sem nacional + flag credenciais on + sem credenciais → prefeitura_login_required_fallback_available (sem POST /empresa)', async () => {
  const prevFlag = process.env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED;
  process.env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED = 'true';

  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: false, homologacao: false },
        login: { producao: true, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () =>
        cadastrarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          certificado: 'cert-1',
          razaoSocial: 'Empresa Teste',
          endereco: buildEmpresaEnderecoValido()
        }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'prefeitura_login_required_fallback_available');
        assert.equal(err.errors?.runtimeDecision?.scenario, 'prefeitura_login_required_fallback_available');
        assert.equal(err.errors?.runtimeDecision?.upstreamCallSkipped, true);
        return true;
      }
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfse\/cidades\/3550308$/);
  } finally {
    process.env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED = prevFlag;
    global.fetch = originalFetch;
  }
});

test('empresa service bloqueia DP02 no preflight quando não há padrão nacional elegível', async () => {
  const { cadastrarEmpresaPlugNotas, inferEmpresaCadastroScenario } = await import(
    '../src/services/plugnotas/empresa.service.js'
  );
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: false, homologacao: false }
      });
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () =>
        cadastrarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          certificado: 'cert-1',
          razaoSocial: 'Empresa Teste',
          endereco: buildEmpresaEnderecoValido()
        }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'prefeitura_ibge_apenas_insuficiente_dp02');
        assert.equal(
          inferEmpresaCadastroScenario({ plugnotasCode: err.errors?.plugnotasCode }),
          'prefeitura_ibge_apenas_insuficiente_dp02'
        );
        assert.equal(err.errors?.runtimeDecision?.padraoNacionalEnabled, false);
        assert.equal(err.errors?.runtimeDecision?.upstreamCallSkipped, true);
        return true;
      }
    );
    assert.equal(calls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service não segue para POST /empresa quando o preflight falha tecnicamente', async () => {
  const { cadastrarEmpresaPlugNotas, inferEmpresaCadastroScenario } = await import(
    '../src/services/plugnotas/empresa.service.js'
  );
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createJsonResponse(503, { message: 'Município indisponível' });
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () =>
        cadastrarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          certificado: 'cert-1',
          razaoSocial: 'Empresa Teste',
          endereco: buildEmpresaEnderecoValido()
        }),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.errors?.plugnotasCode, 'plugnotas_gateway_503');
        assert.equal(err.errors?.plugnotasRequest?.method, 'GET');
        assert.match(String(err.errors?.plugnotasRequest?.path || ''), /\/nfse\/cidades\/3550308$/);
        assert.equal(
          inferEmpresaCadastroScenario({ status: err.status, plugnotasCode: err.errors?.plugnotasCode }),
          'ambiente_configuracao'
        );
        return true;
      }
    );
    assert.equal(calls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service reutiliza o mesmo preflight no fallback POST -> PATCH', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    const entry = { url: String(url), options };
    calls.push(entry);
    if (entry.url.includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    if (entry.options.method === 'POST') {
      return createJsonResponse(409, { message: 'Empresa já cadastrada' });
    }
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(response.operation, 'updated');
    assert.equal(calls.filter((entry) => entry.url.includes('/nfse/cidades/')).length, 1);
    assert.equal(calls.filter((entry) => entry.options.method === 'POST').length, 1);
    assert.equal(calls.filter((entry) => entry.options.method === 'PATCH').length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service rejeita credenciais de prefeitura quando o preflight não exige auth municipal (payload_contrato)', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(200, {
      message: 'Cadastro efetuado com sucesso',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido(),
        nfse: {
          ativo: true,
          config: {
            producao: true,
            prefeitura: { codigoIbge: '3550308', login: 'user', senha: 'secret' }
          }
        }
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'payload_contrato');
        assert.equal(err.errors?.runtimeDecision?.scenario, 'payload_contrato');
        return true;
      }
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfse\/cidades\//);
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST normaliza endereco.codigoCidade numérico para string só dígitos (FR-CID-BE-01)', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: {
        codigoCidade: 3550308,
        uf: 'SP',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cep: '01000000'
      }
    });
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.endereco.codigoCidade, '3550308');
    assert.equal(typeof sent.endereco.codigoCidade, 'string');
  } finally {
    global.fetch = originalFetch;
  }
});

test('PATCH normaliza endereco.codigoCidade numérico para string só dígitos (FR-CID-BE-01)', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      endereco: {
        codigoCidade: 3550308,
        uf: 'SP'
      }
    });
    assert.ok(calls.length >= 1);
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.endereco.codigoCidade, '3550308');
    assert.equal(typeof sent.endereco.codigoCidade, 'string');
  } finally {
    global.fetch = originalFetch;
  }
});

test('PATCH sucesso inclui runtimeDecision coerente (FR-ALNFB Story 1.1 / QA PATCH)', async () => {
  const {
    atualizarEmpresaPlugNotas,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(response.operation, 'updated');
    assert.equal(response.runtimeDecision?.scenario, 'fallback_sync');
    assert.equal(response.runtimeDecision?.upstreamCallSkipped, false);
    assert.equal(inferEmpresaCadastroScenario({ operation: response.operation }), 'fallback_sync');
    // PATCH sem `nfse` ativo: preflight municipal não corre (ver resolveEmpresaCadastroMunicipioPreflightInput).
    assert.ok(calls.length >= 1);
    assert.equal(calls[calls.length - 1].options.method, 'PATCH');
    assert.match(calls[calls.length - 1].url, /\/empresa\/17422651000172$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service faz preflight antes do PATCH explícito usando o ambiente alvo', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: false, homologacao: true },
        login: { producao: true, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      nfse: {
        ativo: true,
        tipoContrato: 0,
        config: { producao: false, nfseNacional: true, consultaNfseNacional: true }
      },
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.method, 'GET');
    assert.match(calls[0].url, /\/nfse\/cidades\/3550308$/);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.match(calls[1].url, /\/empresa\/17422651000172$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST com documentosAtivos só NFSe equivale ao default e não envia campo interno ao Plugnotas (CR-CAD-DOC-01)', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido(),
      documentosAtivos: { nfse: true, nfe: false, nfce: false }
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.equal('documentosAtivos' in sent, false);
    assert.equal(sent.nfce.ativo, false);
    assert.equal('config' in sent.nfce, false);
    assert.equal(sent.nfe.ativo, false);
    assertOfficialNfseContract(sent.nfse);
    assert.equal(sent.inscricaoEstadual, 'ISENTO');
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST com documentosAtivos inválido (todos false) → 400', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  await assert.rejects(
    () => cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      documentosAtivos: { nfse: false, nfe: false, nfce: false }
    }),
    /pelo menos um tipo de documento/
  );
});

test('POST com documentosAtivos só nfce true (nfse false) monta nfce ativo e nfse inativo sem config', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      documentosAtivos: { nfse: false, nfe: false, nfce: true }
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.nfse.ativo, false);
    assert.equal('nacional' in sent.nfse, false);
    assert.equal(sent.nfce.ativo, true);
    assert.ok(sent.nfce.config);
    assert.equal(sent.nfe.ativo, false);
    assert.equal('config' in sent.nfe, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST com documentosAtivos nfe true envia bloco nfe ativo com config mínimo', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      endereco: buildEmpresaEnderecoValido(),
      documentosAtivos: { nfse: true, nfe: true, nfce: false }
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.equal('documentosAtivos' in sent, false);
    assert.equal(sent.nfe.ativo, true);
    assert.ok(sent.nfe.config);
    assert.equal(sent.nfe.config.producao, true);
    assert.equal(sent.nfce.ativo, false);
    assert.equal('config' in sent.nfce, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('PATCH com documentosAtivos não força nfe/nfce inativos por engano (FR-CAD-DOC-05)', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      documentosAtivos: { nfse: true, nfe: false, nfce: true }
    });
    const sent = JSON.parse(calls[0].body);
    assert.equal('documentosAtivos' in sent, false);
    assert.equal(sent.nfce.ativo, true);
    assert.ok(sent.nfce.config);
    assert.equal(sent.nfe.ativo, false);
    assert.equal('config' in sent.nfe, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service POST modo apenas NFSe: inativa nfce/nfe sem config mesmo se cliente envia NFC-e ativa', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido(),
      nfce: {
        ativo: true,
        tipoContrato: 0,
        config: { producao: true, serie: 1, numero: 1, versaoQrCode: 2 }
      }
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.nfce.ativo, false);
    assert.equal('config' in sent.nfce, false);
    assert.equal(sent.nfe.ativo, false);
    assertOfficialNfseContract(sent.nfse);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service tenta atualização quando empresa já existe', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Empresa já cadastrada' });
    }
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.method, 'POST');
    assert.match(calls[0].url, /\/empresa$/);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.match(calls[1].url, /\/empresa\/17422651000172$/);
    assert.equal(response.operation, 'updated');
    assert.equal(inferEmpresaCadastroScenario({ operation: response.operation }), 'fallback_sync');
    assert.equal(response.cnpj, '17422651000172');
    const postBody = JSON.parse(calls[0].options.body);
    assert.deepEqual(postBody.rps, {
      lote: 1,
      numeracao: [{ numero: 1, serie: '1' }]
    });
    const patchBody = JSON.parse(calls[1].options.body);
    assert.equal(Object.prototype.hasOwnProperty.call(patchBody, 'rps'), false);
    assert.equal(patchBody.nfce.ativo, false);
    assert.equal('config' in patchBody.nfce, false);
    assertOfficialNfseContract(patchBody.nfse);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service PATCH /empresa envia rps sanitizado quando o input inclui rps', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      rps: { lote: 9, numeracao: [{ numero: 9, serie: '9' }] },
      nfse: { ativo: true, tipoContrato: 0, nacional: true }
    });
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].body);
    assert.deepEqual(sent.rps, {
      lote: 9,
      numeracao: [{ numero: 9, serie: '9' }]
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service PATCH adapta shape legado para contrato oficial', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      nfse: { ativo: true, tipoContrato: 0, nacional: true }
    });
    const sent = JSON.parse(calls[0].body);
    assertOfficialNfseContract(sent.nfse);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service PATCH prioriza shape oficial quando legado e oficial coexistem', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      nfse: {
        ativo: true,
        tipoContrato: 0,
        nacional: false,
        config: { producao: true, nfseNacional: true, consultaNfseNacional: true }
      }
    });
    const sent = JSON.parse(calls[0].body);
    assertOfficialNfseContract(sent.nfse);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service recupera id quando POST 409 e GET empresa traz certificado', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    return createJsonResponse(200, {
      message: 'OK',
      data: { certificado: 'cert-id-plugnotas-xyz', cpfCnpj: '17422651000172' }
    });
  };

  try {
    const buf = new Uint8Array([1, 2, 3]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'teste.pfx',
      password: 'secret',
      cpfCnpj: '17.422.651/0001-72'
    });
    assert.equal(res.id, 'cert-id-plugnotas-xyz');
    assert.equal(res.raw.recoveredFrom409, true);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/certificado$/);
    assert.equal(calls[0].options.method, 'POST');
    assert.match(calls[1].url, /\/empresa\/17422651000172$/);
    assert.equal(calls[1].options.method, 'GET');
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service usa GET /certificado quando 409 e sem id na empresa', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    if (calls.length === 3) {
      return createJsonResponse(400, { message: 'Filtro não suportado neste ambiente' });
    }
    return createJsonResponse(200, {
      data: [{ id: 'cert-from-list', cpfCnpj: '17422651000172' }]
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'x.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, 'cert-from-list');
    assert.equal(calls.length, 4);
    assert.match(calls[2].url, /\/certificado\?cpfCnpj=17422651000172$/);
    assert.equal(calls[2].options.method, 'GET');
    assert.match(calls[3].url, /\/certificado$/);
    assert.equal(calls[3].options.method, 'GET');
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service resolve id via GET /certificado?cpfCnpj quando a API filtra', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    return createJsonResponse(200, {
      data: [{ id: 'cert-from-filtered', cpfCnpj: '17422651000172' }]
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'f.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, 'cert-from-filtered');
    assert.equal(calls.length, 3);
    assert.match(calls[2].url, /\/certificado\?cpfCnpj=17422651000172$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service recupera id numérico em GET empresa (certificado objeto)', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    return createJsonResponse(200, {
      message: 'OK',
      data: { certificado: { id: 912345 }, cpfCnpj: '17422651000172' }
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'a.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, '912345');
    assert.equal(res.raw.recoveredFrom409, true);
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service encontra id na listagem quando CNPJ só aparece no nome (DN)', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    if (calls.length === 3) {
      return createJsonResponse(400, { message: 'bad query' });
    }
    return createJsonResponse(200, {
      data: [{
        id: 'cert-dn-match',
        nome: 'CN=ACME LTDA, OU=Certificado A1, OU=17422651000172'
      }]
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'b.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, 'cert-dn-match');
    assert.equal(calls.length, 4);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service usa heurística de lista única quando não há match por CNPJ', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    if (calls.length === 3) {
      return createJsonResponse(400, { message: 'bad query' });
    }
    return createJsonResponse(200, {
      data: [{ id: 777, nome: 'Certificado sem documento no payload' }]
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'c.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, '777');
    assert.equal(calls.length, 4);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service resolve id com listagem em data.items (US-MEI-FISC-05)', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    if (calls.length === 3) {
      return createJsonResponse(400, { message: 'Filtro não suportado neste ambiente' });
    }
    return createJsonResponse(200, {
      data: {
        items: [{ idCertificado: 'cert-from-data-items', cpfCnpj: '17422651000172' }]
      }
    });
  };

  try {
    const buf = new Uint8Array([1]);
    const res = await cadastrarCertificadoPlugNotas({
      fileBuffer: buf,
      fileName: 'nested.pfx',
      password: 'p',
      cpfCnpj: '17422651000172'
    });
    assert.equal(res.id, 'cert-from-data-items');
    assert.equal(calls.length, 4);
  } finally {
    global.fetch = originalFetch;
  }
});

test('certificado service retorna erro claro quando 409 e não pode resolver id', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });

  try {
    const buf = new Uint8Array([1]);
    await assert.rejects(
      () => cadastrarCertificadoPlugNotas({
        fileBuffer: buf,
        fileName: 'x.pfx',
        password: 'p'
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'certificado_409_sem_id');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('resolver pós-409 emite log estruturado por etapa quando PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL=warn (US-MEI-FISC-04)', async () => {
  const prevLevel = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'warn';
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (msg, payload) => {
    warnings.push({ msg, payload });
  };

  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Já existe um Certificado com os parâmetros informados' });
    }
    if (calls.length === 2) {
      return createJsonResponse(404, { message: 'Não localizamos qualquer Empresa' });
    }
    if (calls.length === 3) {
      return createJsonResponse(400, { message: 'Filtro não suportado neste ambiente' });
    }
    return createJsonResponse(404, { message: 'Não localizado' });
  };

  try {
    const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
    const buf = new Uint8Array([1]);
    await assert.rejects(
      () => cadastrarCertificadoPlugNotas({
        fileBuffer: buf,
        fileName: 'x.pfx',
        password: 'p',
        cpfCnpj: '17422651000172'
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'certificado_409_sem_id');
        return true;
      }
    );
    assert.ok(warnings.length >= 3, 'esperado log por etapa da cadeia GET');
    const steps = warnings.map((w) => w.payload?.step).filter(Boolean);
    assert.ok(steps.includes('empresa_get'));
    assert.ok(steps.includes('certificado_filtro'));
    assert.ok(steps.includes('certificado_lista'));
    const filtro = warnings.find((w) => w.payload?.step === 'certificado_filtro');
    assert.equal(filtro?.payload?.outcome, 'http_error');
    assert.equal(filtro?.payload?.httpStatus, 400);
    assert.match(String(filtro?.payload?.cpfCnpj || ''), /\d{2}\*\*\*\d{2}/);
  } finally {
    console.warn = origWarn;
    global.fetch = originalFetch;
    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prevLevel;
  }
});

test('empresa service consulta empresa com GET /empresa/:cnpj', async () => {
  const { consultarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cpfCnpj: '17422651000172', razaoSocial: 'ACME' }
    });
  };

  try {
    const response = await consultarEmpresaPlugNotas('17.422.651/0001-72');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'GET');
    assert.match(calls[0].url, /\/empresa\/17422651000172$/);
    assert.equal(response.data.razaoSocial, 'ACME');
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service POST preserva inscricaoEstadual quando cliente informa', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido(),
      inscricaoEstadual: '123456789'
    });
    const sent = JSON.parse(calls[0].options.body);
    assert.equal(sent.inscricaoEstadual, '123456789');
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service PATCH com inscricaoEstadual vazia normaliza para ISENTO', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      inscricaoEstadual: '   '
    });
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.inscricaoEstadual, 'ISENTO');
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service atualiza empresa sem certificado no payload', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    const response = await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido({ logradouro: 'Rua A', numero: '1' })
    });

    assert.equal(response.operation, 'updated');
    assert.equal(response.cnpj, '17422651000172');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'PATCH');
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.certificado, undefined);
    assert.equal(sent.nfce, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service PATCH com nfce no corpo: substitui por bloco inativo sem config', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      nfce: {
        ativo: true,
        tipoContrato: 0,
        config: { producao: true, serie: 1, numero: 1, versaoQrCode: 2 }
      }
    });
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.nfce.ativo, false);
    assert.equal('config' in sent.nfce, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service atualizar mapeia 404 "não localizamos" para mensagem orientativa', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse(404, {
      message: 'Não localizamos qualquer Empresa com os parâmetros informados'
    });
  };

  try {
    await assert.rejects(
      () => atualizarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        razaoSocial: 'Empresa Teste'
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'empresa_nao_cadastrada');
        assert.ok(Array.isArray(err.errors?.plugnotasUpdateAttempts));
        assert.equal(calls.length, 1);
        assert.match(String(err.message), /Não há cadastro desta empresa no emissor fiscal/);
        assert.match(String(err.message), /certificado/);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service atualizar inclui plugnotasUpdateAttempts quando todas as rotas falham', async () => {
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse(400, { message: 'Esta rota não existe no serviço' });
  };

  try {
    await assert.rejects(
      () => atualizarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        razaoSocial: 'Empresa Teste'
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(Array.isArray(err.errors?.plugnotasUpdateAttempts));
        assert.equal(err.errors.plugnotasUpdateAttempts.length, 1);
        assert.equal(calls.length, 1);
        return /Esta rota não existe no serviço/.test(String(err.message));
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service POST /empresa inclui detalhes de validação no 400', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(400, {
      message: 'Falha na validação do JSON de Empresa',
      errors: [{ field: 'endereco.logradouro', error: 'inválido' }]
    });
  };

  try {
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido()
      }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 400);
        assert.match(String(err.message), /endereco\.logradouro/);
        assert.match(String(err.message), /inválido/);
        assert.equal(err.errors?.plugnotasCode, PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE);
        assert.equal(
          inferEmpresaCadastroScenario({
            status: err.status,
            method: err.errors?.plugnotasRequest?.method,
            path: err.errors?.plugnotasRequest?.path,
            plugnotasCode: err.errors?.plugnotasCode
          }),
          'payload_contrato'
        );
        assert.ok(
          !String(err.errors?.plugnotasCode || '').startsWith('plugnotas_gateway_'),
          'CR-GW-02: 400 validação não deve usar código plugnotas_gateway_*'
        );
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service classifica upstream 400 de prefeitura.login como exceção municipal bloqueada', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(400, {
      message: 'Falha na validação do JSON de Empresa: fields.nfse.config.prefeitura.login: Preenchimento obrigatório'
    });
  };

  try {
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido()
      }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 400);
        assert.equal(err.errors?.plugnotasCode, 'prefeitura_login_required_blocked');
        assert.equal(err.errors?.plugnotasRequest?.method, 'POST');
        assert.equal(err.errors?.plugnotasRequest?.path, '/empresa');
        assert.equal(err.errors?.httpStatus, 400);
        assert.match(String(err.message), /nfs-e nacional/i);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service POST /empresa: 502 HTML normaliza mensagem + plugnotas_gateway_502 (integração requestJson)', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const html = '<html><body>502 Bad Gateway</body></html>';
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createHtmlErrorResponse(502, html);
  };

  try {
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido()
      }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 502);
        assert.match(String(err.message), /emissor fiscal não está a responder/i);
        assert.equal(err.errors?.plugnotasCode, 'plugnotas_gateway_502');
        assert.equal(err.errors?.plugnotasRequest?.method, 'POST');
        assert.ok(String(err.errors?.plugnotasRequest?.path || '').includes('/empresa'));
        assert.equal(
          inferEmpresaCadastroScenario({
            status: err.status,
            method: err.errors?.plugnotasRequest?.method,
            path: err.errors?.plugnotasRequest?.path,
            plugnotasCode: err.errors?.plugnotasCode
          }),
          'ambiente_configuracao'
        );
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST falho por prefeitura.login bloqueado e GET posterior negativo preservam causalidade', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    consultarEmpresaPlugNotas,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(400, {
        message: 'Falha na validação do JSON de Empresa: fields.nfse.config.prefeitura.login: Preenchimento obrigatório'
      });
    }
    return createJsonResponse(404, { message: 'Empresa não encontrada' });
  };

  try {
    let postError = null;
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido()
      }),
      (err) => {
        postError = err;
        return true;
      }
    );
    let getError = null;
    await assert.rejects(
      () => consultarEmpresaPlugNotas('17422651000172'),
      (err) => {
        getError = err;
        return true;
      }
    );

    assert.equal(calls.length, 2);
    assert.equal(postError?.errors?.plugnotasCode, 'prefeitura_login_required_blocked');
    assert.equal(postError?.errors?.plugnotasRequest?.method, 'POST');
    assert.equal(postError?.errors?.plugnotasRequest?.path, '/empresa');
    assert.equal(getError?.status, 404);
    assert.equal(getError?.errors?.plugnotasRequest?.method, 'GET');
    assert.equal(getError?.errors?.plugnotasRequest?.path, '/empresa/17422651000172');
    assert.equal(getError?.errors?.plugnotasCode, 'empresa_nao_cadastrada');
    assert.equal(
      inferEmpresaCadastroScenario({
        status: getError?.status,
        method: getError?.errors?.plugnotasRequest?.method,
        path: getError?.errors?.plugnotasRequest?.path,
        plugnotasCode: getError?.errors?.plugnotasCode
      }),
      'empresa_nao_cadastrada'
    );
    assert.doesNotMatch(String(getError?.message || ''), /rota errada/i);
    assert.match(String(getError?.message || ''), /Não há cadastro desta empresa no emissor fiscal/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('GET /empresa 404 de rota inválida classifica ambiente/configuração sem mascarar ausência de cadastro', async () => {
  const {
    consultarEmpresaPlugNotas,
    PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async () => createJsonResponse(404, {
    message: 'Esta rota não existe no serviço'
  });

  try {
    await assert.rejects(
      () => consultarEmpresaPlugNotas('17422651000172'),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 404);
        assert.equal(err.errors?.plugnotasCode, PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE);
        assert.equal(
          inferEmpresaCadastroScenario({
            status: err.status,
            method: err.errors?.plugnotasRequest?.method,
            path: err.errors?.plugnotasRequest?.path,
            plugnotasCode: err.errors?.plugnotasCode
          }),
          'ambiente_configuracao'
        );
        assert.equal(
          inferEmpresaCadastroScenario({
            status: 404,
            method: 'GET',
            path: '/empresa/17422651000172',
            plugnotasCode: ''
          }),
          null
        );
        assert.doesNotMatch(String(err.message || ''), /não há cadastro desta empresa no emissor fiscal/i);
        assert.match(String(err.message || ''), /Esta rota não existe no serviço/i);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service classifica 401 como ambiente/configuração sem criar scenarioCode novo', async () => {
  const {
    cadastrarEmpresaPlugNotas,
    PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE,
    inferEmpresaCadastroScenario
  } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    return createJsonResponse(401, {
      message: 'Token inválido'
    });
  };

  try {
    await assert.rejects(
      () => cadastrarEmpresaPlugNotas({
        cpfCnpj: '17422651000172',
        certificado: 'cert-1',
        razaoSocial: 'Empresa Teste',
        endereco: buildEmpresaEnderecoValido()
      }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 401);
        assert.equal(err.errors?.plugnotasCode, PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE);
        assert.equal(
          inferEmpresaCadastroScenario({
            status: err.status,
            method: err.errors?.plugnotasRequest?.method,
            path: err.errors?.plugnotasRequest?.path,
            plugnotasCode: err.errors?.plugnotasCode
          }),
          'ambiente_configuracao'
        );
        assert.equal(Object.prototype.hasOwnProperty.call(err.errors || {}, 'scenarioCode'), false);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('cadastrarCertificadoPlugNotas: 502 HTML normaliza mensagem + plugnotas_gateway_502 (integração requestFormData)', async () => {
  const { cadastrarCertificadoPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const html = '<html><title>502 Bad Gateway</title></html>';
  global.fetch = async () => createHtmlErrorResponse(502, html);

  try {
    await assert.rejects(
      () => cadastrarCertificadoPlugNotas({
        fileBuffer: Buffer.from('fake-pfx'),
        fileName: 'cert.pfx',
        password: 'secret'
      }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 502);
        assert.match(String(err.message), /emissor fiscal não está a responder/i);
        assert.equal(err.errors?.plugnotasCode, 'plugnotas_gateway_502');
        assert.equal(err.errors?.plugnotasRequest?.method, 'POST');
        assert.ok(String(err.errors?.plugnotasRequest?.path || '').includes('/certificado'));
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('empresa service trata conflito sem update como sucesso operacional', async () => {
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse();
    }
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return createJsonResponse(409, { message: 'Empresa já cadastrada' });
    }
    return createJsonResponse(404, { message: 'Operação não suportada' });
  };

  try {
    const response = await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: buildEmpresaEnderecoValido()
    });

    assert.equal(calls.length, 2);
    assert.equal(response.operation, 'existing');
    assert.match(
      String(response.message || ''),
      /sucesso operacional/i
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST oficial não volta a derivar nfse.config.prefeitura.codigoIbge no hot path', async () => {
  const prevDerive = process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
  process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = 'true';
  const { cadastrarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: true, homologacao: false },
        login: { producao: false, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    calls.push({ url: String(url), options });
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await cadastrarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      certificado: 'cert-1',
      razaoSocial: 'Empresa Teste',
      endereco: {
        codigoCidade: '4115200',
        estado: 'PR',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cep: '87000000'
      }
    });
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].options.body);
    assertOfficialNfseContract(sent.nfse);
    assert.equal(Object.prototype.hasOwnProperty.call(sent.nfse.config || {}, 'prefeitura'), false);
  } finally {
    global.fetch = originalFetch;
    if (prevDerive === undefined) delete process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
    else process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = prevDerive;
  }
});

test('PATCH oficial não volta a derivar nfse.config.prefeitura.codigoIbge no hot path', async () => {
  const prevDerive = process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
  process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = 'true';
  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/nfse/cidades/')) {
      return createCidadePreflightResponse({
        padraoNacional: { producao: true, homologacao: false },
        login: { producao: false, homologacao: false },
        senha: { producao: false, homologacao: false }
      });
    }
    calls.push({ url: String(url), options, body: options.body });
    return createJsonResponse(200, {
      message: 'Empresa atualizada',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await atualizarEmpresaPlugNotas({
      cpfCnpj: '17422651000172',
      razaoSocial: 'Empresa Teste',
      nfse: {
        ativo: true,
        tipoContrato: 0,
        config: { producao: true, nfseNacional: true, consultaNfseNacional: true }
      },
      endereco: {
        codigoCidade: '4115200',
        estado: 'PR',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cep: '87000000'
      }
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'PATCH');
    const sent = JSON.parse(calls[0].body);
    assertOfficialNfseContract(sent.nfse);
    assert.equal(Object.prototype.hasOwnProperty.call(sent.nfse.config || {}, 'prefeitura'), false);
  } finally {
    global.fetch = originalFetch;
    if (prevDerive === undefined) delete process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
    else process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = prevDerive;
  }
});

test('PATCH legado mantém bloqueio BFF antes do Plugnotas quando rollback por IBGE está ativo', async () => {
  const prevDerive = process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
  const prevBlock = process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED;
  const prevCodes = process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES;
  process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = 'true';
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = '4115200';

  const { atualizarEmpresaPlugNotas } = await import('../src/services/plugnotas/empresa.service.js');
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async () => {
    calls.push(1);
    return createJsonResponse(200, {
      message: 'OK',
      data: { cnpj: '17422651000172' }
    });
  };

  try {
    await assert.rejects(
      () =>
        atualizarEmpresaPlugNotas({
          cpfCnpj: '17422651000172',
          razaoSocial: 'Empresa Teste',
          nfse: {
            ativo: true,
            tipoContrato: 0,
            nacional: true,
            config: {
              prefeitura: { codigoIbge: '4115200' }
            }
          }
        }),
      (err) =>
        err instanceof HttpError
        && err.status === 400
        && err.errors?.plugnotasCode === 'prefeitura_ibge_apenas_insuficiente_dp02'
    );
    assert.equal(calls.length, 0);
  } finally {
    global.fetch = originalFetch;
    if (prevDerive === undefined) delete process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE;
    else process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE = prevDerive;
    if (prevBlock === undefined) delete process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED;
    else process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED = prevBlock;
    if (prevCodes === undefined) delete process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES;
    else process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES = prevCodes;
  }
});
