import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consultarEmpresaAndReconcileMirror,
  persistDocumentosAtivosMirrorAfterEmpresa,
  reconcileMirrorFromEmpresaJson
} from '../src/services/mei-notas-documentos-mirror.js';

test('persistDocumentosAtivosMirrorAfterEmpresa chama save com userId e seleção normalizada', async () => {
  const calls = [];
  await persistDocumentosAtivosMirrorAfterEmpresa(
    'user-1',
    { documentosAtivos: { nfse: true, nfe: false, nfce: false } },
    {
      saveDocumentosAtivosMirror: async (uid, sel, saveDeps) => {
        calls.push({ uid, sel, saveDeps });
      }
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].uid, 'user-1');
  assert.deepStrictEqual(calls[0].sel, { nfse: true, nfe: false, nfce: false });
  assert.deepStrictEqual(calls[0].saveDeps, {});
});

test('persistDocumentosAtivosMirrorAfterEmpresa repassa mirrorSaveDeps ao save', async () => {
  const calls = [];
  await persistDocumentosAtivosMirrorAfterEmpresa(
    'user-1',
    { documentosAtivos: { nfse: true, nfe: false, nfce: false } },
    {
      mirrorSaveDeps: { logWarn: () => {} },
      saveDocumentosAtivosMirror: async (uid, sel, saveDeps) => {
        calls.push({ uid, saveDeps });
      }
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].saveDeps.logWarn, 'function');
});

test('persistDocumentosAtivosMirrorAfterEmpresa sem documentosAtivos não chama save', async () => {
  let called = false;
  await persistDocumentosAtivosMirrorAfterEmpresa(
    'user-1',
    { razaoSocial: 'X' },
    {
      saveDocumentosAtivosMirror: async () => {
        called = true;
      }
    }
  );
  assert.equal(called, false);
});

test('persistDocumentosAtivosMirrorAfterEmpresa engole erro de validação (todos false)', async () => {
  let called = false;
  await persistDocumentosAtivosMirrorAfterEmpresa(
    'user-1',
    { documentosAtivos: { nfse: false, nfe: false, nfce: false } },
    {
      saveDocumentosAtivosMirror: async () => {
        called = true;
      }
    }
  );
  assert.equal(called, false);
});

test('reconcileMirrorFromEmpresaJson chama save com selecção extraída do GET', async () => {
  const calls = [];
  await reconcileMirrorFromEmpresaJson(
    'user-1',
    {
      nfse: { ativo: true },
      nfe: { ativo: false },
      nfce: { ativo: false }
    },
    {
      saveDocumentosAtivosMirror: async (uid, sel, saveDeps) => {
        calls.push({ uid, sel, saveDeps });
      }
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].uid, 'user-1');
  assert.deepStrictEqual(calls[0].sel, { nfse: true, nfe: false, nfce: false });
  assert.deepStrictEqual(calls[0].saveDeps, {});
});

test('reconcileMirrorFromEmpresaJson sem userId não chama save', async () => {
  let called = false;
  await reconcileMirrorFromEmpresaJson(undefined, { nfse: { ativo: true } }, {
    saveDocumentosAtivosMirror: async () => {
      called = true;
    }
  });
  assert.equal(called, false);
});

test('reconcileMirrorFromEmpresaJson com todos inactivos não chama save', async () => {
  let called = false;
  await reconcileMirrorFromEmpresaJson(
    'user-1',
    { nfse: { ativo: false }, nfe: { ativo: false }, nfce: { ativo: false } },
    {
      saveDocumentosAtivosMirror: async () => {
        called = true;
      }
    }
  );
  assert.equal(called, false);
});

test('reconcileMirrorFromEmpresaJson engole erro de save', async () => {
  await reconcileMirrorFromEmpresaJson(
    'user-1',
    { nfse: { ativo: true } },
    {
      saveDocumentosAtivosMirror: async () => {
        throw new Error('supabase down');
      }
    }
  );
});

test('consultarEmpresaAndReconcileMirror: após consulta bem-sucedida chama reconcile uma vez', async () => {
  const order = [];
  const payload = {
    nfse: { ativo: true },
    nfe: { ativo: false },
    nfce: { ativo: false }
  };
  const out = await consultarEmpresaAndReconcileMirror('user-1', '12345678000199', {
    consultarEmpresaPlugNotas: async (cnpj) => {
      order.push('consult');
      assert.equal(cnpj, '12345678000199');
      return payload;
    },
    reconcileMirrorFromEmpresaJson: async (uid, data) => {
      order.push('reconcile');
      assert.equal(uid, 'user-1');
      assert.strictEqual(data, payload);
    }
  });
  assert.strictEqual(out, payload);
  assert.deepStrictEqual(order, ['consult', 'reconcile']);
});
