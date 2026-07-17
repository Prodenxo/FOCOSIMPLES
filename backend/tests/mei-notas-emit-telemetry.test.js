import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

test('emitirNota: validation_error regista mei_emit_outcome com failure_phase (resolve)', async () => {
  const captured = [];
  const origInfo = console.info;
  console.info = (...args) => {
    captured.push(args);
  };
  try {
    const { emitirNota } = await import('../src/services/mei-notas.service.js');
    await assert.rejects(
      () => emitirNota('user-1', { documentType: 'UNKNOWN_XXX' }),
      /documentType inválido/
    );
  } finally {
    console.info = origInfo;
  }
  const meiLine = captured
    .map((a) => a[1])
    .find((s) => typeof s === 'string' && s.includes('"mei_emit_outcome"'));
  assert.ok(meiLine, 'deve registar mei_emit_outcome');
  const row = JSON.parse(String(meiLine));
  assert.equal(row.outcome, 'validation_error');
  assert.equal(row.failure_phase, 'resolve');
  assert.equal(row.document_type, 'INVALID');
});
