import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.PLUGNOTAS_API_BASE_URL = process.env.PLUGNOTAS_API_BASE_URL || 'https://plugnotas.example.com';
process.env.PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || 'plugnotas-key';

test('nfse service valida parametros obrigatorios de download', async () => {
  const { downloadNfsePdf, downloadNfseXml } = await import('../src/services/plugnotas/nfse.service.js');

  await assert.rejects(() => downloadNfsePdf(''), /ID da NFSe é obrigatório/);
  await assert.rejects(() => downloadNfseXml(''), /ID da NFSe é obrigatório/);
});

test('nfse service baixa PDF com sucesso', async () => {
  const { downloadNfsePdf } = await import('../src/services/plugnotas/nfse.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/pdf' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
  });

  try {
    const result = await downloadNfsePdf('nfse-id');
    assert.equal(result.contentType, 'application/pdf');
    assert.equal(Buffer.isBuffer(result.buffer), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfse service preserva detalhes de validacao retornados pela API', async () => {
  const { emitirNfse } = await import('../src/services/plugnotas/nfse.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NFSe',
      errors: [
        { field: 'tomador.cpfCnpj', error: 'campo obrigatório' }
      ]
    })
  });

  try {
    await assert.rejects(
      () => emitirNfse({ idIntegracao: 'nfse-teste' }),
      /Falha na validação do JSON de NFSe: tomador\.cpfCnpj: campo obrigatório/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfse service preserva detalhes quando API retorna mapa de erros por campo', async () => {
  const { emitirNfse } = await import('../src/services/plugnotas/nfse.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NFSe',
      errors: {
        'tomador.cpfCnpj': ['campo obrigatório'],
        'prestador.endereco.cep': ['deve conter 8 dígitos']
      }
    })
  });

  try {
    await assert.rejects(
      () => emitirNfse({ idIntegracao: 'nfse-teste' }),
      /Falha na validação do JSON de NFSe: tomador\.cpfCnpj: campo obrigatório \| prestador\.endereco\.cep: deve conter 8 dígitos/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfse service inclui detalhes quando API retorna errors como array de objetos com message', async () => {
  const { emitirNfse } = await import('../src/services/plugnotas/nfse.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NFSe',
      errors: [
        { field: 'servico.discriminacao', message: 'não pode ficar em branco' }
      ]
    })
  });

  try {
    await assert.rejects(
      () => emitirNfse({ idIntegracao: 'nfse-teste' }),
      /servico\.discriminacao: não pode ficar em branco/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('nfse service inclui detalhes quando API retorna errors como array de strings', async () => {
  const { emitirNfse } = await import('../src/services/plugnotas/nfse.service.js');
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    headers: { get: () => 'application/json' },
    json: async () => ({
      message: 'Falha na validação do JSON de NFSe',
      errors: ['Campo X é obrigatório', 'Campo Y inválido']
    })
  });

  try {
    await assert.rejects(
      () => emitirNfse({ idIntegracao: 'nfse-teste' }),
      /Campo X é obrigatório.*Campo Y inválido|Campo Y inválido.*Campo X é obrigatório/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
