import { Platform } from 'react-native'
import {
  PASSWORD_RECOVERY_PREFIX,
  capturePasswordRecoveryFromUrlSync,
  getPasswordResetRedirectUrl,
  isPasswordRecoveryPath,
  parsePasswordRecoveryUrl,
} from '../passwordRecoveryDeepLink'

describe('parsePasswordRecoveryUrl', () => {
  it('ignora URL irrelevante', () => {
    expect(parsePasswordRecoveryUrl('https://example.com/dashboard')).toEqual({ kind: 'ignored' });
  });

  it('ignora /reset-password sem tokens', () => {
    expect(parsePasswordRecoveryUrl('https://example.com/reset-password')).toEqual({
      kind: 'invalid_recovery_link',
    });
  });

  it('extrai tokens em hash (deep link)', () => {
    const url = `${PASSWORD_RECOVERY_PREFIX}#access_token=a1&refresh_token=r1&type=recovery`;
    expect(parsePasswordRecoveryUrl(url)).toEqual({
      kind: 'password_recovery',
      mode: 'session',
      accessToken: 'a1',
      refreshToken: 'r1',
      type: 'recovery',
    });
  });

  it('extrai tokens em hash (web)', () => {
    const url = 'https://app.example.com/reset-password#access_token=a1&refresh_token=r1&type=recovery';
    expect(parsePasswordRecoveryUrl(url)).toEqual({
      kind: 'password_recovery',
      mode: 'session',
      accessToken: 'a1',
      refreshToken: 'r1',
      type: 'recovery',
    });
  });

  it('extrai token_hash em query (e-mail customizado)', () => {
    const url = 'https://meiinfinito.com.br/reset-password?token_hash=abc123&type=recovery';
    expect(parsePasswordRecoveryUrl(url)).toEqual({
      kind: 'password_recovery',
      mode: 'token_hash',
      tokenHash: 'abc123',
      type: 'recovery',
    });
  });

  it('extrai tokens em query', () => {
    const url = `${PASSWORD_RECOVERY_PREFIX}?access_token=a2&refresh_token=r2&type=recovery`;
    expect(parsePasswordRecoveryUrl(url)).toEqual({
      kind: 'password_recovery',
      mode: 'session',
      accessToken: 'a2',
      refreshToken: 'r2',
      type: 'recovery',
    });
  });

  it('retorna invalid_recovery_link sem tokens', () => {
    const url = `${PASSWORD_RECOVERY_PREFIX}?type=recovery`;
    expect(parsePasswordRecoveryUrl(url)).toEqual({ kind: 'invalid_recovery_link' });
  });

  it('retorna invalid_recovery_link com type diferente', () => {
    const url = `${PASSWORD_RECOVERY_PREFIX}?access_token=a&refresh_token=r&type=magiclink`;
    expect(parsePasswordRecoveryUrl(url)).toEqual({ kind: 'invalid_recovery_link' });
  });
});

describe('isPasswordRecoveryPath', () => {
  it('reconhece /reset-password', () => {
    expect(isPasswordRecoveryPath('/reset-password')).toBe(true);
  });
});

describe('getPasswordResetRedirectUrl', () => {
  it('retorna deep link fora da web', () => {
    expect(getPasswordResetRedirectUrl()).toContain('://reset-password');
  });
});

describe('capturePasswordRecoveryFromUrlSync', () => {
  const originalWindow = global.window;

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      // @ts-expect-error cleanup
      delete global.window;
    }
  });

  it('captura tokens do hash na web e limpa a URL', () => {
    const replaceState = jest.fn()
    const platformOs = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    Object.defineProperty(global, 'window', {
      value: {
        location: {
          href: 'https://app.example.com/reset-password#access_token=t1&refresh_token=r1&type=recovery',
          pathname: '/reset-password',
        },
        history: { replaceState },
      },
      writable: true,
    })

    const payload = capturePasswordRecoveryFromUrlSync()
    Object.defineProperty(Platform, 'OS', { value: platformOs })

    expect(payload).toEqual({
      mode: 'session',
      accessToken: 't1',
      refreshToken: 'r1',
      type: 'recovery',
    })
    expect(replaceState).toHaveBeenCalledWith({}, '', '/reset-password')
  })
});
