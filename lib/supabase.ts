import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getPublicEnv } from './runtimeEnv';

function resolveSupabaseConfig() {
  const url =
    getPublicEnv('EXPO_PUBLIC_SUPABASE_URL') ||
    Constants.expoConfig?.extra?.supabaseUrl ||
    '';
  const key =
    getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
    Constants.expoConfig?.extra?.supabaseAnonKey ||
    '';
  return { url, key };
}

/** Avalia na hora (suporta env-config.js injetado no Docker após o HTML carregar). */
export function isSupabaseConfigured(): boolean {
  const { url, key } = resolveSupabaseConfig();
  return Boolean(url && key);
}

export const SUPABASE_AUTH_STORAGE_KEY = 'financas-pessoais-auth';

// Storage customizado para React Native usando AsyncStorage
const customStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Erro crítico ao obter item do storage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Erro crítico ao salvar item no storage:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Erro crítico ao remover item do storage:', error);
    }
  },
};

export async function clearSupabaseAuthStorage(): Promise<void> {
  await customStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const { url, key } = resolveSupabaseConfig();
  const effectiveUrl = url || 'https://placeholder.supabase.co';
  const effectiveKey = key || 'placeholder-anon-key';

  supabaseClient = createClient(effectiveUrl, effectiveKey, {
    auth: {
      persistSession: true,
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      storage: customStorage as any,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return supabaseClient;
}

/** Cliente lazy — lê env-config.js (Docker) ou .env (dev) na primeira utilização. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

