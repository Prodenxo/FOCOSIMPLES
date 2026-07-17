import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateNfseRpsForEmit,
  reserveNextNfseRpsNumber,
} from '../src/services/plugnotas/nfse-rps-allocator.js';

test('reserveNextNfseRpsNumber usa RPC quando disponível', async () => {
  let calls = 0;
  const getDb = () => ({
    rpc: async (name, args) => {
      calls += 1;
      assert.equal(name, 'mei_nfse_reserve_rps');
      assert.equal(args.p_cnpj, '65805583000173');
      assert.equal(args.p_floor, 90);
      return { data: 91, error: null };
    },
  });

  const numero = await reserveNextNfseRpsNumber(getDb, { cnpj: '65805583000173', floor: 90 });
  assert.equal(numero, 91);
  assert.equal(calls, 1);
});

test('reserveNextNfseRpsNumber faz fallback floor+1 sem RPC', async () => {
  let upserted = null;
  const getDb = () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async (row) => {
        upserted = row;
        return { error: null };
      },
    }),
    rpc: async (name) => {
      if (name === 'mei_nfse_set_rps_last') {
        return { error: { message: 'function not found' } };
      }
      return { data: null, error: { message: 'function not found', code: '42883' } };
    },
  });

  const numero = await reserveNextNfseRpsNumber(getDb, { cnpj: '65805583000173', floor: 94 });
  assert.equal(numero, 95);
  assert.equal(upserted?.last_numero, 95);
});

test('allocateNfseRpsForEmit ignora contador Postgres inflado e segue empresa PlugNotas', async () => {
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      notas: [{ dps: { numero: 110, serie: '1' }, rps: { numero: 110, serie: '1' } }],
    }),
  });

  let setLastCalls = 0;
  let reserveCalls = 0;
  try {
    const getDb = () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { last_numero: 114 }, error: null }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
      rpc: async (name, args) => {
        if (name === 'mei_nfse_set_rps_last') {
          setLastCalls += 1;
          assert.equal(args.p_last, 111);
          return { error: null };
        }
        if (name === 'mei_nfse_reserve_rps') {
          reserveCalls += 1;
          assert.equal(args.p_floor, 111);
          return { data: 112, error: null };
        }
        return { data: null, error: { message: 'unknown' } };
      },
    });

    const allocation = await allocateNfseRpsForEmit(getDb, '65805583000173', 100, {
      nfse: { config: { rps: { serie: '1', numero: 112, lote: 1 } } },
    });
    assert.equal(allocation.floor, 111);
    assert.equal(allocation.numero, 112);
    assert.equal(setLastCalls, 1);
    assert.equal(reserveCalls, 1);
  } finally {
    global.fetch = original;
  }
});

test('allocateNfseRpsForEmit após DPS 114 rejeitado reserva 115', async () => {
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      notas: [{ dps: { numero: 114, serie: '1' }, rps: { numero: 114, serie: '1' } }],
    }),
  });

  try {
    const getDb = () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { last_numero: 114 }, error: null }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
      rpc: async (name, args) => {
        if (name === 'mei_nfse_set_rps_last') {
          assert.equal(args.p_last, 114);
          return { error: null };
        }
        if (name === 'mei_nfse_reserve_rps') {
          assert.equal(args.p_floor, 114);
          return { data: 115, error: null };
        }
        return { data: null, error: { message: 'unknown' } };
      },
    });

    const allocation = await allocateNfseRpsForEmit(getDb, '65805583000173', 114, {
      nfse: { config: { rps: { serie: '1', numero: 112, lote: 1 } } },
    });
    assert.equal(allocation.numero, 115);
  } finally {
    global.fetch = original;
  }
});
