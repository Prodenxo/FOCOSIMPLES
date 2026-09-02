const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockMemory.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockMemory.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockMemory.delete(key);
    return Promise.resolve();
  }),
}));

import {
  ORIGINAL_SESSION_KEY,
  backupAdminSession,
  clearBackedUpAdminSession,
  hasBackedUpAdminSession,
  readBackedUpAdminSession,
} from '../auth-session-backup';

describe('auth-session-backup', () => {
  beforeEach(() => {
    mockMemory.clear();
  });

  it('guarda e lê sessão do administrador', async () => {
    await backupAdminSession({ access_token: 'a', refresh_token: 'r' });
    expect(await hasBackedUpAdminSession()).toBe(true);
    expect(await readBackedUpAdminSession()).toEqual({
      access_token: 'a',
      refresh_token: 'r',
    });
  });

  it('limpa backup após clearBackedUpAdminSession', async () => {
    await backupAdminSession({ access_token: 'a', refresh_token: 'r' });
    await clearBackedUpAdminSession();
    expect(mockMemory.has(ORIGINAL_SESSION_KEY)).toBe(false);
    expect(await hasBackedUpAdminSession()).toBe(false);
  });
});
