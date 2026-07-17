import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/utils/errors.js';
import {
  parseEmpresaJsonPayloadField,
  withOrchestrationPhase
} from '../src/services/plugnotas/plugnotas-emitente-setup.service.js';

test('parseEmpresaJsonPayloadField aceita string JSON', () => {
  const o = parseEmpresaJsonPayloadField('{"cpfCnpj":"17422651000172"}');
  assert.equal(o.cpfCnpj, '17422651000172');
});

test('parseEmpresaJsonPayloadField rejeita ausente', () => {
  assert.throws(() => parseEmpresaJsonPayloadField(''), /payload/);
});

test('parseEmpresaJsonPayloadField rejeita JSON inválido', () => {
  assert.throws(() => parseEmpresaJsonPayloadField('{'), /JSON válido/);
});

test('withOrchestrationPhase preserva status e acrescenta fase', () => {
  const err = new HttpError(400, 'x', { plugnotasCode: 'y' });
  const next = withOrchestrationPhase(err, 'empresa');
  assert.ok(next instanceof HttpError);
  assert.equal(next.status, 400);
  assert.equal(next.message, 'x');
  assert.equal(next.errors?.plugnotasCode, 'y');
  assert.equal(next.errors?.orchestrationPhase, 'empresa');
});

test('withOrchestrationPhase normaliza Error genérico para HttpError 500 com fase', () => {
  const next = withOrchestrationPhase(new Error('falha interna'), 'certificado');
  assert.ok(next instanceof HttpError);
  assert.equal(next.status, 500);
  assert.equal(next.message, 'falha interna');
  assert.equal(next.errors?.orchestrationPhase, 'certificado');
});

test('withOrchestrationPhase usa status numérico em objecto duck-typed', () => {
  const next = withOrchestrationPhase({ status: 503, message: 'indisponível' }, 'empresa');
  assert.equal(next.status, 503);
  assert.equal(next.message, 'indisponível');
  assert.equal(next.errors?.orchestrationPhase, 'empresa');
});
