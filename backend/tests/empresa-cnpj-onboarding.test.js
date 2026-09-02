import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPRESA_ONBOARDING_SELECT, isValidEmpresaCnpj } from '../src/services/empresa-cnpj-onboarding.service.js';

describe('empresa-cnpj-onboarding', () => {
  it('valida CNPJ com 14 dígitos', () => {
    assert.equal(isValidEmpresaCnpj('12.345.678/0001-90'), true);
    assert.equal(isValidEmpresaCnpj('12345678000190'), true);
    assert.equal(isValidEmpresaCnpj('123'), false);
    assert.equal(isValidEmpresaCnpj(null), false);
    assert.equal(isValidEmpresaCnpj(''), false);
  });

  it('select de onboarding inclui id (evita 400 Empresa não encontrada)', () => {
    const cols = EMPRESA_ONBOARDING_SELECT.split(', ');
    assert.ok(cols.includes('id'));
    assert.ok(cols.includes('cnpj'));
  });
});
