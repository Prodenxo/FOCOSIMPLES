/**
 * Testes do apiClient. Mock do supabase para isolar auth.
 */
process.env.EXPO_PUBLIC_MEI_API_URL = 'https://test.example.com';

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: class MockFile {},
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

import { getMeiApiAuthHeaders } from '../apiClient';
import { supabase } from '../supabase';

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMeiApiAuthHeaders (buildAuthHeaders)', () => {
    it('lança "User not authenticated." quando não há sessão', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
      await expect(getMeiApiAuthHeaders()).rejects.toThrow('User not authenticated.');
    });

    it('retorna Authorization Bearer quando há token', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'fake-token-123' } },
      });
      const headers = await getMeiApiAuthHeaders();
      expect(headers).toHaveProperty('Authorization', 'Bearer fake-token-123');
    });
  });
});
