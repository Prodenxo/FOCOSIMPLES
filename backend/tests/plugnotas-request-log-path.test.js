import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPlugnotasPathOrUrlForLog } from '../src/services/plugnotas/plugnotas-request-log-path.js';

test('maskPlugnotasPathOrUrlForLog mascara cpfCnpj na query', () => {
  assert.equal(
    maskPlugnotasPathOrUrlForLog('/certificado?cpfCnpj=17422651000172'),
    '/certificado?cpfCnpj=17***72'
  );
});

test('maskPlugnotasPathOrUrlForLog mascara cpfCnpj codificado na query', () => {
  assert.equal(
    maskPlugnotasPathOrUrlForLog('/certificado?cpfCnpj=17.422.651%2F0001-72'),
    '/certificado?cpfCnpj=17***72'
  );
});

test('maskPlugnotasPathOrUrlForLog mascara segunda query cpfCnpj', () => {
  assert.equal(
    maskPlugnotasPathOrUrlForLog('/x?foo=1&cpfCnpj=17422651000172'),
    '/x?foo=1&cpfCnpj=17***72'
  );
});

test('maskPlugnotasPathOrUrlForLog mascara /empresa/:14', () => {
  assert.equal(
    maskPlugnotasPathOrUrlForLog('/empresa/17422651000172'),
    '/empresa/17***72'
  );
});

test('maskPlugnotasPathOrUrlForLog URL base + path com cpfCnpj', () => {
  assert.equal(
    maskPlugnotasPathOrUrlForLog('https://api.plugnotas.com.br/certificado?cpfCnpj=17422651000172'),
    'https://api.plugnotas.com.br/certificado?cpfCnpj=17***72'
  );
});
