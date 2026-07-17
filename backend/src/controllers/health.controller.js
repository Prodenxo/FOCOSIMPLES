import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import { serviceUnavailable } from '../utils/errors.js';

export const supabaseHealth = async (_req, res, next) => {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw serviceUnavailable('SUPABASE_SERVICE_ROLE_KEY não configurada');
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
