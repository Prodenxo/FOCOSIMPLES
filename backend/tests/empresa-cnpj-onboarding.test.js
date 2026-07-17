import { describe, expect, it } from 'vitest';
import { isValidEmpresaCnpj } from '../src/services/empresa-cnpj-onboarding.service.js';

describe('empresa-cnpj-onboarding', () => {
  it('valida CNPJ com 14 dígitos', () => {
    expect(isValidEmpresaCnpj('12.345.678/0001-90')).toBe(true);
    expect(isValidEmpresaCnpj('12345678000190')).toBe(true);
    expect(isValidEmpresaCnpj('123')).toBe(false);
    expect(isValidEmpresaCnpj(null)).toBe(false);
    expect(isValidEmpresaCnpj('')).toBe(false);
  });
});
