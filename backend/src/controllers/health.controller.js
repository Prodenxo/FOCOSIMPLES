import { createSupabaseClient, getServiceDbConfigError } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import { serviceUnavailable } from '../utils/errors.js';
import { query } from '../config/pg.js';

export const supabaseHealth = async (_req, res, next) => {
  try {
    const configError = getServiceDbConfigError();
    if (configError) {
      throw serviceUnavailable(configError);
    }

    if (String(env.AUTH_MODE || '').trim().toLowerCase() === 'local') {
      await query('SELECT 1 AS ok');
      return sendSuccess(res, { ok: true, mode: 'local', db: 'postgres' }, 'Postgres OK');
    }

    const supabase = createSupabaseClient({ useServiceRole: true });
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      throw serviceUnavailable(error.message || 'Falha ao consultar Supabase Auth');
    }

    return sendSuccess(res, { ok: true, total: data?.total ?? null }, 'Supabase Auth OK');
  } catch (error) {
    return next(error);
  }
};
