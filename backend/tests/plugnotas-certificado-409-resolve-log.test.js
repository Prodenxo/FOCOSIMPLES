import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('getPlugnotasCert409ResolveLogLevel reconhece off, warn, info e error', async () => {
  const prev = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  try {
    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'off';
    const { getPlugnotasCert409ResolveLogLevel } = await import(
      '../src/services/plugnotas/plugnotas-certificado-409-resolve-log.js'
    );
    assert.equal(getPlugnotasCert409ResolveLogLevel(), 'off');

    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'warn';
    assert.equal(getPlugnotasCert409ResolveLogLevel(), 'warn');

    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'info';
    assert.equal(getPlugnotasCert409ResolveLogLevel(), 'info');

    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'error';
    assert.equal(getPlugnotasCert409ResolveLogLevel(), 'error');
  } finally {
    if (prev === undefined) delete process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
    else process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prev;
  }
});

test('logPlugnotasCertificado409Resolve não emite quando level=off', async () => {
  const prev = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'off';
  const {
    logPlugnotasCertificado409Resolve,
    PLUGNOTAS_CERT_409_RESOLVE_STEPS
  } = await import('../src/services/plugnotas/plugnotas-certificado-409-resolve-log.js');

  let calls = 0;
  const o = console.warn;
  console.warn = () => {
    calls += 1;
  };
  try {
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.EMPRESA_GET,
      cpfCnpj14: '17422651000172',
      outcome: 'http_error',
      httpStatus: 404
    });
    assert.equal(calls, 0);
  } finally {
    console.warn = o;
    if (prev === undefined) delete process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
    else process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prev;
  }
});

test('logPlugnotasCertificado409Resolve mascara CNPJ no payload', async () => {
  const prev = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'warn';
  const {
    logPlugnotasCertificado409Resolve,
    PLUGNOTAS_CERT_409_RESOLVE_STEPS
  } = await import('../src/services/plugnotas/plugnotas-certificado-409-resolve-log.js');

  let payload;
  const o = console.warn;
  console.warn = (_msg, p) => {
    payload = p;
  };
  try {
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.CERTIFICADO_FILTRO,
      cpfCnpj14: '17422651000172',
      outcome: 'no_id_resolved',
      listItemCount: 2
    });
    assert.equal(payload.tag, 'plugnotas_certificado_409_resolve');
    assert.equal(payload.step, 'certificado_filtro');
    assert.equal(payload.cpfCnpj, '17***72');
    assert.equal(payload.listItemCount, 2);
    assert.equal(payload.firstItemKeysCount, undefined);
  } finally {
    console.warn = o;
    if (prev === undefined) delete process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
    else process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prev;
  }
});

test('logPlugnotasCertificado409Resolve usa console.info quando level=info', async () => {
  const prev = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'info';
  const {
    logPlugnotasCertificado409Resolve,
    PLUGNOTAS_CERT_409_RESOLVE_STEPS
  } = await import('../src/services/plugnotas/plugnotas-certificado-409-resolve-log.js');

  let calls = 0;
  let payload;
  const o = console.info;
  console.info = (_msg, p) => {
    calls += 1;
    payload = p;
  };
  try {
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.EMPRESA_GET,
      cpfCnpj14: '17422651000172',
      outcome: 'http_error',
      httpStatus: 404
    });
    assert.equal(calls, 1);
    assert.equal(payload.cpfCnpj, '17***72');
    assert.equal(payload.tag, 'plugnotas_certificado_409_resolve');
  } finally {
    console.info = o;
    if (prev === undefined) delete process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
    else process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prev;
  }
});

test('logPlugnotasCertificado409Resolve usa console.error quando level=error', async () => {
  const prev = process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
  process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = 'error';
  const {
    logPlugnotasCertificado409Resolve,
    PLUGNOTAS_CERT_409_RESOLVE_STEPS
  } = await import('../src/services/plugnotas/plugnotas-certificado-409-resolve-log.js');

  let calls = 0;
  let payload;
  const o = console.error;
  console.error = (_msg, p) => {
    calls += 1;
    payload = p;
  };
  try {
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.CERTIFICADO_LISTA,
      cpfCnpj14: '17422651000172',
      outcome: 'parse_listagem',
      listItemCount: 0
    });
    assert.equal(calls, 1);
    assert.equal(payload.cpfCnpj, '17***72');
    assert.equal(payload.listItemCount, 0);
  } finally {
    console.error = o;
    if (prev === undefined) delete process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL;
    else process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL = prev;
  }
});
