import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEmpresaPlugnotasDocumentSelectionForPost,
  extractDocumentosAtivosFromEmpresaResponse
} from '../src/services/plugnotas/plugnotas-empresa-documentos-ativos.js';

test('extract: só NFS-e ativo', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    nfse: { ativo: true, tipoContrato: 0 },
    nfe: { ativo: false, tipoContrato: 0 },
    nfce: { ativo: false, tipoContrato: 0 }
  });
  assert.deepStrictEqual(r, { nfse: true, nfe: false, nfce: false });
});

test('extract: três tipos activos', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    nfse: { ativo: true },
    nfe: { ativo: true },
    nfce: { ativo: true }
  });
  assert.deepStrictEqual(r, { nfse: true, nfe: true, nfce: true });
});

test('extract: todos inactivos → null (não gravar espelho inválido)', () => {
  assert.equal(
    extractDocumentosAtivosFromEmpresaResponse({
      nfse: { ativo: false },
      nfe: { ativo: false },
      nfce: { ativo: false }
    }),
    null
  );
});

test('extract: blocos ausentes → false e null se nenhum ativo implícito', () => {
  assert.equal(extractDocumentosAtivosFromEmpresaResponse({}), null);
});

test('extract: só NFC-e ativo', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    nfse: { ativo: false },
    nfe: { ativo: false },
    nfce: { ativo: true }
  });
  assert.deepStrictEqual(r, { nfse: false, nfe: false, nfce: true });
});

test('extract: ativo como string "1"', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    nfse: { ativo: '1' },
    nfe: {},
    nfce: {}
  });
  assert.deepStrictEqual(r, { nfse: true, nfe: false, nfce: false });
});

test('extract: entrada inválida → null', () => {
  assert.equal(extractDocumentosAtivosFromEmpresaResponse(null), null);
  assert.equal(extractDocumentosAtivosFromEmpresaResponse(undefined), null);
  assert.equal(extractDocumentosAtivosFromEmpresaResponse([]), null);
  assert.equal(extractDocumentosAtivosFromEmpresaResponse('x'), null);
});

test('POST selection: nfseMode municipal → nfseNacional e consultaNfseNacional falsos', () => {
  const payload = {
    nfse: {
      ativo: true,
      config: {
        producao: true,
        prefeitura: { codigoIbge: '3550308', login: 'a', senha: 'b' }
      }
    }
  };
  applyEmpresaPlugnotasDocumentSelectionForPost(
    payload,
    { nfse: true, nfe: false, nfce: false },
    { nfseMode: 'municipal' }
  );
  assert.equal(payload.nfse.config.nfseNacional, false);
  assert.equal(payload.nfse.config.consultaNfseNacional, false);
  assert.equal(payload.nfse.config.prefeitura.login, 'a');
  assert.equal(payload.nfse.config.prefeitura.senha, 'b');
});

test('POST selection: nfseMode nacional → contrato NFS-e Nacional (padrão)', () => {
  const payload = {};
  applyEmpresaPlugnotasDocumentSelectionForPost(
    payload,
    { nfse: true, nfe: false, nfce: false },
    { nfseMode: 'nacional' }
  );
  assert.equal(payload.nfse.config.nfseNacional, true);
  assert.equal(payload.nfse.config.consultaNfseNacional, true);
});

test('extract: nfse como array estranho → tratado como inactivo', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    nfse: [],
    nfe: { ativo: true },
    nfce: { ativo: false }
  });
  assert.deepStrictEqual(r, { nfse: false, nfe: true, nfce: false });
});

test('extract: blocos dentro de envelope data', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    data: {
      nfse: { ativo: true },
      nfe: { ativo: false },
      nfce: { ativo: false }
    }
  });
  assert.deepStrictEqual(r, { nfse: true, nfe: false, nfce: false });
});

test('extract: blocos dentro de envelope empresa', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    empresa: {
      nfse: { ativo: false },
      nfe: { ativo: true },
      nfce: { ativo: false }
    }
  });
  assert.deepStrictEqual(r, { nfse: false, nfe: true, nfce: false });
});

test('extract: blocos em data.empresa', () => {
  const r = extractDocumentosAtivosFromEmpresaResponse({
    data: {
      empresa: {
        nfse: { ativo: false },
        nfe: { ativo: false },
        nfce: { ativo: true }
      }
    }
  });
  assert.deepStrictEqual(r, { nfse: false, nfe: false, nfce: true });
});
