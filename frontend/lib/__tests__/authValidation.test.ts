import {
  validateSignupEmail,
  validateSignupPassword,
  validatePasswordMatch,
  validateOptionalDisplayName,
} from '../authValidation';

describe('authValidation', () => {
  it('validateSignupEmail', () => {
    expect(validateSignupEmail('')).toBeTruthy();
    expect(validateSignupEmail('bad')).toBeTruthy();
    expect(validateSignupEmail('a@b.co')).toBeNull();
  });

  it('validateSignupPassword', () => {
    expect(validateSignupPassword('')).toBeTruthy();
    expect(validateSignupPassword('12345')).toBeTruthy();
    expect(validateSignupPassword('123456')).toBeNull();
  });

  it('validatePasswordMatch', () => {
    expect(validatePasswordMatch('a', 'b')).toBeTruthy();
    expect(validatePasswordMatch('x', 'x')).toBeNull();
  });

  it('validateOptionalDisplayName', () => {
    expect(validateOptionalDisplayName('')).toBeNull();
    expect(validateOptionalDisplayName('x'.repeat(121))).toBeTruthy();
  });
});
