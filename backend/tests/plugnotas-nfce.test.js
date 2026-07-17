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

test('nfce service valida parâmetros obrigatórios de consulta e download', async () => {
  const { consultarNfce, downloadNfcePdf, downloadNfceXml } = await import('../src/services/plugnotas/nfce.service.js');

  await assert.rejects(() => consultarNfce(''), /ID da NFC-e é obrigatório/);
  await assert.rejects(() => downloadNfcePdf(''), /ID da NFC-e é obrigatório/);
  await assert.rejects(() => downloadNfceXml(''), /ID da NFC-e é obrigatório/);
});

test('nfce service envia emissão no endpoint correto', async () => {
  const { emitirNfce } = await import('../src/services/plugnotas/nfce.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse({ documents: [{ id: 'nfce-1' }], message: 'ok' });
  };

  try {
    const response = await emitirNfce({
      idIntegracao: 'nfce-int-1',
      emitente: { cpfCnpj: '12345678000199' },
      itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfce$/);
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), [{
      idIntegracao: 'nfce-int-1',
      emitente: { cpfCnpj: '12345678000199' },
      itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
    }]);
    assert.equal(response.documents[0].id, 'nfce-1');
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfce service preserva detalhes de validação retornados pela API', async () => {
  const { emitirNfce } = await import('../src/services/plugnotas/nfce.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NFC-e',
      error: {
        details: [
          { field: 'emitente.cpfCnpj', reason: 'CNPJ inválido' },
          { field: 'itens[0].ncm', reason: 'NCM inválido' }
        ]
      }
    })
  });

  try {
    await assert.rejects(
      () => emitirNfce({
        emitente: { cpfCnpj: '123' },
        itens: [{ codigo: 'A1', descricao: 'Produto A', valor: 10 }]
      }),
      /Falha na validação do JSON de NFC-e: emitente\.cpfCnpj: CNPJ inválido \| itens\[0\]\.ncm: NCM inválido/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfce service envia cancelamento com payload de justificativa', async () => {
  const { cancelarNfce } = await import('../src/services/plugnotas/nfce.service.js');
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return createJsonResponse({ message: 'cancelamento solicitado' });
  };

  try {
    const result = await cancelarNfce('nfce-123', { reason: 'Cliente desistiu da compra' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/nfce\/nfce-123\/cancelamento$/);
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
