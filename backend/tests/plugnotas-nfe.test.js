import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://api.sandbox.plugnotas.com.br';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';

const createJsonResponse = (payload) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => payload
});

test('nfe service valida parâmetros obrigatórios de consulta e download', async () => {
  const { consultarNfe, downloadNfePdf, downloadNfeXml } = await import('../src/services/plugnotas/nfe.service.js');

  await assert.rejects(() => consultarNfe(''), /ID da NF-e é obrigatório/);
  await assert.rejects(() => downloadNfePdf(''), /ID da NF-e é obrigatório/);
  await assert.rejects(() => downloadNfeXml(''), /ID da NF-e é obrigatório/);
});

test('nfe service envia emissão no endpoint correto', async () => {
  const { emitirNfe } = await import('../src/services/plugnotas/nfe.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse({ documents: [{ id: 'nfe-1' }], message: 'ok' });
  };

  try {
    const response = await emitirNfe({
      idIntegracao: 'nfe-int-1',
      emitente: { cpfCnpj: '12345678000199' },
      itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfe$/);
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), [{
      idIntegracao: 'nfe-int-1',
      emitente: { cpfCnpj: '12345678000199' },
      itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
    }]);
    assert.equal(response.documents[0].id, 'nfe-1');
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfe service suporta rota de relatório', async () => {
  const { relatorioNfe } = await import('../src/services/plugnotas/nfe.service.js');
  const originalFetch = global.fetch;
  let calledUrl = '';

  global.fetch = async (url) => {
    calledUrl = String(url);
    return createJsonResponse([{ emitente: { cpfCnpj: '123' }, documentos: [] }]);
  };

  try {
    const result = await relatorioNfe({ cpfCnpj: '12345678000199' });
    assert.match(calledUrl, /\/nfe\/relatorio\?cpfCnpj=12345678000199$/);
    assert.equal(Array.isArray(result), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfe service preserva detalhes de validação retornados pela API', async () => {
  const { emitirNfe } = await import('../src/services/plugnotas/nfe.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NF-e',
      errors: {
        'destinatario.cpfCnpj': ['campo obrigatório'],
        'itens[0].cfop': ['inválido']
      }
    })
  });

  try {
    await assert.rejects(
      () => emitirNfe({
        emitente: { cpfCnpj: '12345678000199' },
        itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
      }),
      /Falha na validação do JSON de NF-e: destinatario\.cpfCnpj: campo obrigatório \| itens\[0\]\.cfop: inválido/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfe service envia cancelamento com payload de justificativa', async () => {
  const { cancelarNfe } = await import('../src/services/plugnotas/nfe.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse({ message: 'cancelamento solicitado' });
  };

  try {
    const result = await cancelarNfe('nfe-123', { reason: 'Cliente desistiu da compra' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfe\/nfe-123\/cancelamento$/);
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      justificativa: 'Cliente desistiu da compra',
      reason: 'Cliente desistiu da compra'
    });
    assert.equal(result.message, 'cancelamento solicitado');
  } finally {
    global.fetch = originalFetch;
  }
});
