import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let pool = null;

/**
 * Pool Postgres (EasyPanel / DATABASE_URL). Lazy — só cria se houver URL.
 * @returns {import('pg').Pool}
 */
export const getPgPool = () => {
  if (pool) return pool;

  const connectionString = env.DATABASE_URL || env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL (ou SUPABASE_DB_URL) não configurado');
  }

  const sslDisabled =
    /sslmode=disable/i.test(connectionString)
    || env.DB_SSL === 'false'
    || env.DB_SSL === '0';

  pool = new Pool({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 10,
  });

  pool.on('error', (err) => {
    console.error('[pg] erro inesperado no pool', err);
  });

  return pool;
};

/**
 * @param {string} text
 * @param {unknown[]} [params]
 */
export const query = async (text, params = []) => {
  const client = getPgPool();
  return client.query(text, params);
};

export const closePgPool = async () => {
  if (!pool) return;
  await pool.end();
  pool = null;
};
