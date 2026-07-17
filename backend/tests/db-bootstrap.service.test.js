import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const { bootstrapDatabase } = await import('../src/services/db-bootstrap.service.js');

test('db bootstrap cria schema DAS e valida conexão', async () => {
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql);
    },
    end: async () => {}
  };
  const factory = async () => client;

  const result = await bootstrapDatabase({
    dbUrl: 'postgres://fake',
    autoSchema: true,
    failFast: true,
    dbClientFactory: factory
  });

  assert.equal(result.connected, true);
  assert.equal(result.schemaEnsured, true);
  assert.ok(queries.some((sql) => String(sql).includes('create table if not exists public.das_mensal_status')));
});

test('db bootstrap é idempotente ao rodar mais de uma vez', async () => {
  const makeClient = () => ({
    query: async () => {},
    end: async () => {}
  });
  const factory = async () => makeClient();

  await bootstrapDatabase({
    dbUrl: 'postgres://fake',
    autoSchema: true,
    failFast: true,
    dbClientFactory: factory
  });
  await bootstrapDatabase({
    dbUrl: 'postgres://fake',
    autoSchema: true,
    failFast: true,
    dbClientFactory: factory
  });
});

test('db bootstrap propaga falha de conexão quando failFast está ativo', async () => {
  const factory = async () => {
    throw new Error('connection failed');
  };

  await assert.rejects(
    () => bootstrapDatabase({
      dbUrl: 'postgres://fake',
      autoSchema: true,
      failFast: true,
      dbClientFactory: factory
    }),
    /connection failed/
  );
});
