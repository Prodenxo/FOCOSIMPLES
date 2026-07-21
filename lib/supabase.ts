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

function isPlaceholderSupabaseUrl(url: string): boolean {
  const u = String(url || '').toLowerCase();
  return !u || u.includes('placeholder.supabase');
}

/** Avalia na hora (suporta env-config.js injetado no Docker após o HTML carregar). */
export function isSupabaseConfigured(): boolean {
  const { url, key } = resolveSupabaseConfig();
  if (!url || !key) return false;
  if (isPlaceholderSupabaseUrl(url)) return false;
  return true;
}

/** Auth local (ou sem Supabase real): não deve bater em placeholder.supabase.co. */
function shouldBlockSupabaseDataAccess(): boolean {
  if (!isSupabaseConfigured()) return true;
  const flag = getPublicEnv('EXPO_PUBLIC_AUTH_MODE').trim().toLowerCase();
  return flag === 'local';
}

/**
 * Builder compatível com await supabase.from(...).select()...
 * Não lança — devolve error, para o app não quebrar com Uncaught Error.
 */
function createBlockedQueryBuilder(table: string) {
  const message = `[local-auth] supabase.from('${table}') bloqueado. Use a API do backend.`;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(message);
  }
  const result = {
    data: null,
    error: { message, code: 'LOCAL_AUTH_BLOCKED' },
    count: null,
    status: 0,
    statusText: '',
  };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const methods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'containedBy',
    'or',
    'not',
    'filter',
    'match',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'csv',
    'throwOnError',
  ];
  for (const name of methods) {
    builder[name] = chain;
  }
  builder.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(onFulfilled as never, onRejected as never);
  return builder;
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
    // Evita spam / crash de placeholder.supabase.co no modo local
    if (prop === 'from' && shouldBlockSupabaseDataAccess()) {
      return (table: string) => createBlockedQueryBuilder(table);
    }
    if (prop === 'functions' && shouldBlockSupabaseDataAccess()) {
      return {
        invoke: async (name: string) => ({
          data: null,
          error: {
            message: `[local-auth] supabase.functions.invoke('${name}') bloqueado. Use a API do backend.`,
          },
        }),
      };
    }
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

