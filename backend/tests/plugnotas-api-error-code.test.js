import test from 'node:test';
import assert from 'node:assert/strict';

import { getPlugnotasCodeFromApiErrors } from '../src/utils/plugnotas-api-error-code.js';

test('getPlugnotasCodeFromApiErrors retorna string quando plugnotasCode estável', () => {
  assert.equal(
    getPlugnotasCodeFromApiErrors({ plugnotasCode: 'certificado_409_sem_id' }),
    'certificado_409_sem_id'
  );
});

test('getPlugnotasCodeFromApiErrors retorna null para entrada inválida ou ausente', () => {
  assert.equal(getPlugnotasCodeFromApiErrors(null), null);
  assert.equal(getPlugnotasCodeFromApiErrors(undefined), null);
  assert.equal(getPlugnotasCodeFromApiErrors([]), null);
  assert.equal(getPlugnotasCodeFromApiErrors({}), null);
  assert.equal(getPlugnotasCodeFromApiErrors({ plugnotasCode: 123 }), null);
});
