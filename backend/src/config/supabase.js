import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from './env.js';
import { createPgServiceClient } from './pgSupabaseCompat.js';

const isLocalAuthMode = () =>
  String(env.AUTH_MODE || '').trim().toLowerCase() === 'local';

const resolveRealtimeOptions = () => {
  if (typeof globalThis.WebSocket === 'undefined') {
    return { transport: ws };
  }
  return {};
};

const assertSupabaseConfigured = () => {
  if (env.SUPABASE_URL && (env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
    return;
  }
  if (isLocalAuthMode()) {
    throw new Error(
      'Esta operação ainda não tem caminho Postgres (AUTH_MODE=local). Não use cliente Supabase aqui.',
    );
  }
  throw new Error('SUPABASE_URL / keys não configurados no backend.');
};

export const createSupabaseClient = ({
  accessToken,
  useServiceRole = false
} = {}) => {
  // AUTH local: service-role vira cliente Postgres compatível (notas / certificado / RPS).
  if (isLocalAuthMode() && useServiceRole) {
    return createPgServiceClient();
  }

  assertSupabaseConfigured();

  const key = useServiceRole && env.SUPABASE_SERVICE_ROLE_KEY
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.SUPABASE_ANON_KEY;

  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const authOptions = useServiceRole
    ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    : {};

  return createClient(env.SUPABASE_URL, key, {
    auth: authOptions,
    global: { headers },
    realtime: resolveRealtimeOptions()
  });
};

let _serviceRoleClient = null;

export const getServiceRoleClient = () => {
  if (isLocalAuthMode()) {
    return createPgServiceClient();
  }
  if (!_serviceRoleClient) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado');
    }
    _serviceRoleClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: resolveRealtimeOptions()
    });
  }
  return _serviceRoleClient;
};
