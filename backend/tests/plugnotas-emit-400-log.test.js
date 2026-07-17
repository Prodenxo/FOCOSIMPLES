import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('logPlugnotasEmitir400 usa prefixo, idIntegracao e mascara cpfCnpj', async () => {
  const { logPlugnotasEmitir400 } = await import('../src/services/plugnotas/plugnotas-emit-400-log.js');
  const lines = [];
  const orig = console.error;
  console.error = (...a) => {
    lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  };
  try {
    logPlugnotasEmitir400({
      kind: 'NFCe',
      responseBody: { message: 'Falha' },
      body: [{ idIntegracao: 'int-test', emitente: { cpfCnpj: '12345678000199' } }]
    });
  } finally {
    console.error = orig;
  }
  const blob = lines.join('\n');
  assert.match(blob, /\[emissao-fiscal NFCe\]/);
  assert.match(blob, /400 response/);
  assert.match(blob, /idIntegracao.*int-test/);
  assert.match(blob, /12\*\*\*99/);
});

test('resolvePlugnotasRequestJsonError em 400 chama log e retorna mensagem', async () => {
  const { resolvePlugnotasRequestJsonError } = await import('../src/services/plugnotas/plugnotas-emit-400-log.js');
  const lines = [];
  const orig = console.error;
  console.error = (...a) => {
    lines.push(a.join(' '));
  };
  try {
    const response = {
      status: 400,
      statusText: 'Bad Request',
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Erro', errors: ['a'] })
    };
    const msg = await resolvePlugnotasRequestJsonError(response, {
      kind: 'NFe',
      body: [{ idIntegracao: 'x' }]
    });
    assert.match(msg, /Erro/);
    assert.match(lines.join(' '), /\[emissao-fiscal NFe\]/);
  } finally {
    console.error = orig;
  }
});

test('logPlugnotasEmitir400 usa console.warn quando PLUGNOTAS_EMIT_400_LOG_LEVEL=warn', async () => {
  const prev = process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL;
  process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL = 'warn';
  const { logPlugnotasEmitir400 } = await import('../src/services/plugnotas/plugnotas-emit-400-log.js');
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => {
    warns.push(a.join(' '));
  };
  try {
    logPlugnotasEmitir400({ kind: 'NFe', responseBody: { message: 'x' } });
  } finally {
    console.warn = origWarn;
    if (prev === undefined) delete process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL;
    else process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL = prev;
  }
  assert.ok(warns.some((w) => w.includes('[emissao-fiscal NFe]')));
  assert.ok(warns.some((w) => w.includes('400 response')));
});
