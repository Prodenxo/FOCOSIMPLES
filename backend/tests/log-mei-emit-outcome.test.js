import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, badRequest } from '../src/utils/errors.js';
import {
  logMeiEmitOutcome,
  extractMeiEmitHttpMeta,
  fallbackDocumentTypeLabelFromInput,
  sanitizePlugnotasStatusForLog,
  sanitizePlugnotasCodeForEmitLog,
  MEI_EMIT_ROUTE_EMITIR_NOTA
} from '../src/utils/logMeiEmitOutcome.js';

test('fallbackDocumentTypeLabelFromInput: vazio → NFSE', () => {
  assert.equal(fallbackDocumentTypeLabelFromInput({}), 'NFSE');
});

test('fallbackDocumentTypeLabelFromInput: tipo inválido → INVALID', () => {
  assert.equal(fallbackDocumentTypeLabelFromInput({ documentType: 'ZZ' }), 'INVALID');
});

test('sanitizePlugnotasStatusForLog: rejeita caracteres fora do conjunto seguro', () => {
  assert.equal(sanitizePlugnotasStatusForLog('ok-processando'), 'ok-processando');
  assert.equal(sanitizePlugnotasStatusForLog('Autorizada'), 'Autorizada');
  assert.equal(sanitizePlugnotasStatusForLog('Concluída'), 'Concluída');
  assert.equal(sanitizePlugnotasStatusForLog('{"x":1}'), null);
});

test('extractMeiEmitHttpMeta: HttpError com path Plugnotas', () => {
  const err = new HttpError(400, 'falha', {
    plugnotasRequest: { method: 'POST', path: '/nfse/emitir' }
  });
  const meta = extractMeiEmitHttpMeta(err);
  assert.equal(meta.http_status, 400);
  assert.equal(meta.plugnotas_path_masked, '/nfse/emitir');
  assert.equal(meta.plugnotas_code, null);
});

test('extractMeiEmitHttpMeta: plugnotasCode em errors', () => {
  const err = new HttpError(400, 'x', { plugnotasCode: 'plugnotas_gateway_502' });
  const meta = extractMeiEmitHttpMeta(err);
  assert.equal(meta.plugnotas_code, 'plugnotas_gateway_502');
});

test('sanitizePlugnotasCodeForEmitLog: rejeita valores estranhos', () => {
  assert.equal(sanitizePlugnotasCodeForEmitLog('payload_contrato'), 'payload_contrato');
  assert.equal(sanitizePlugnotasCodeForEmitLog('a;b'), null);
});

test('extractMeiEmitHttpMeta: erro genérico', () => {
  assert.deepEqual(extractMeiEmitHttpMeta(new Error('x')), {
    http_status: null,
    plugnotas_path_masked: null,
    plugnotas_code: null
  });
});

test('logMeiEmitOutcome: JSON fechado só com campos esperados (success)', () => {
  const lines = { info: [], warn: [] };
  const origInfo = console.info;
  const origWarn = console.warn;
  console.info = (...args) => {
    lines.info.push(args);
  };
  console.warn = (...args) => {
    lines.warn.push(args);
  };
  try {
    logMeiEmitOutcome({
      document_type: 'NFSE',
      duration_ms: 12,
      outcome: 'success',
      route: MEI_EMIT_ROUTE_EMITIR_NOTA,
      plugnotas_status: 'processando'
    });
    assert.equal(lines.warn.length, 0);
    assert.equal(lines.info.length, 1);
    const parsed = JSON.parse(String(lines.info[0][1]));
    assert.equal(parsed.event, 'mei_emit_outcome');
    assert.equal(parsed.route, 'emitir_nota');
    assert.equal(parsed.document_type, 'NFSE');
    assert.equal(parsed.duration_ms, 12);
    assert.equal(parsed.outcome, 'success');
    assert.equal(parsed.plugnotas_status, 'processando');
    assert.equal('user_id' in parsed, false);
    assert.equal('payload' in parsed, false);
  } finally {
    console.info = origInfo;
    console.warn = origWarn;
  }
});

test('logMeiEmitOutcome: plugnotas_error usa warn', () => {
  const lines = { info: [], warn: [] };
  const origInfo = console.info;
  const origWarn = console.warn;
  console.info = (...args) => {
    lines.info.push(args);
  };
  console.warn = (...args) => {
    lines.warn.push(args);
  };
  try {
    logMeiEmitOutcome({
      document_type: 'NFE',
      duration_ms: 5,
      outcome: 'plugnotas_error',
      http_status: 503,
      plugnotas_path_masked: '/nfe'
    });
    assert.equal(lines.info.length, 0);
    assert.equal(lines.warn.length, 1);
    const parsed = JSON.parse(String(lines.warn[0][1]));
    assert.equal(parsed.outcome, 'plugnotas_error');
    assert.equal(parsed.http_status, 503);
  } finally {
    console.info = origInfo;
    console.warn = origWarn;
  }
});

test('logMeiEmitOutcome: validation_error usa info', () => {
  const lines = { info: [], warn: [] };
  const origInfo = console.info;
  const origWarn = console.warn;
  console.info = (...args) => {
    lines.info.push(args);
  };
  console.warn = (...args) => {
    lines.warn.push(args);
  };
  try {
    logMeiEmitOutcome({
      document_type: 'INVALID',
      duration_ms: 1,
      outcome: 'validation_error',
      http_status: 400
    });
    assert.equal(lines.warn.length, 0);
    const parsed = JSON.parse(String(lines.info[0][1]));
    assert.equal(parsed.outcome, 'validation_error');
  } finally {
    console.info = origInfo;
    console.warn = origWarn;
  }
});

test('extractMeiEmitHttpMeta: badRequest sem plugnotasRequest', () => {
  const meta = extractMeiEmitHttpMeta(badRequest('x'));
  assert.equal(meta.http_status, 400);
  assert.equal(meta.plugnotas_path_masked, null);
  assert.equal(meta.plugnotas_code, null);
});

test('logMeiEmitOutcome: failure_phase só se valor canónico', () => {
  const lines = { info: [] };
  const orig = console.info;
  console.info = (...args) => {
    lines.info.push(args);
  };
  try {
    logMeiEmitOutcome({
      document_type: 'NFSE',
      duration_ms: 1,
      outcome: 'validation_error',
      failure_phase: 'validate'
    });
    let parsed = JSON.parse(String(lines.info[0][1]));
    assert.equal(parsed.failure_phase, 'validate');
    lines.info.length = 0;
    logMeiEmitOutcome({
      document_type: 'NFSE',
      duration_ms: 1,
      outcome: 'validation_error',
      failure_phase: 'not_a_phase'
    });
    parsed = JSON.parse(String(lines.info[0][1]));
    assert.equal('failure_phase' in parsed, false);
  } finally {
    console.info = orig;
  }
});
