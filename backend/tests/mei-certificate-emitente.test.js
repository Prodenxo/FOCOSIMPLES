import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmitenteRowFragment,
  emitenteRowToApiShape,
  emitenteDbRowHasNfseData,
  parseDocumentosAtivosMirrorValue
} from '../src/services/mei-certificate-store.js';

test('normalizeEmitenteRowFragment — CEP e UF', () => {
  const row = normalizeEmitenteRowFragment({
    cep: '80.010-000',
    uf: 'pr',
    razaoSocial: '  ACME  '
  });
  assert.equal(row.cep, '80010000');
  assert.equal(row.uf, 'PR');
  assert.equal(row.razao_social, 'ACME');
});

test('normalizeEmitenteRowFragment — update parcial omite vazios', () => {
  const row = normalizeEmitenteRowFragment(
    { razaoSocial: 'X', logradouro: '' },
    { omitEmpty: true }
  );
  assert.equal(row.razao_social, 'X');
  assert.equal(row.logradouro, undefined);
});

test('emitenteRowToApiShape — defaults', () => {
  const api = emitenteRowToApiShape({
    razao_social: 'A',
    regime_tributario: '2',
    optante_simples_nacional: false,
    ibge_municipio: '4106902',
    cidade: 'Curitiba',
    uf: 'PR'
  });
  assert.equal(api.razaoSocial, 'A');
  assert.equal(api.regimeTributario, '2');
  assert.equal(api.simplesNacional, false);
  assert.equal(api.codigoCidade, '4106902');
  assert.equal(api.tipoLogradouro, 'Rua');
  assert.equal(api.rpsLote, 1);
  assert.equal(api.rpsNumero, 1);
  assert.equal(api.rpsSerie, '1');
});

test('emitenteRowToApiShape — persiste rps_lote / rps_numero / rps_serie', () => {
  const api = emitenteRowToApiShape({
    razao_social: 'X',
    rps_lote: 7,
    rps_numero: 42,
    rps_serie: ' A '
  });
  assert.equal(api.rpsLote, 7);
  assert.equal(api.rpsNumero, 42);
  assert.equal(api.rpsSerie, 'A');
});

test('emitenteRowToApiShape — persiste tipo_logradouro', () => {
  const api = emitenteRowToApiShape({
    tipo_logradouro: 'Av.',
    logradouro: 'Brasil',
    razao_social: 'X'
  });
  assert.equal(api.tipoLogradouro, 'Av.');
  assert.equal(api.logradouro, 'Brasil');
});

test('normalizeEmitenteRowFragment — tipoLogradouro', () => {
  const row = normalizeEmitenteRowFragment({ tipoLogradouro: '  Av.  ' });
  assert.equal(row.tipo_logradouro, 'Av.');
});

test('emitenteRowToApiShape — normaliza CEP, UF e IBGE', () => {
  const api = emitenteRowToApiShape({
    razao_social: 'X',
    cep: '80.010-000',
    uf: 'pr',
    ibge_municipio: '4106902',
    optante_simples_nacional: true
  });
  assert.equal(api.cep, '80010000');
  assert.equal(api.estado, 'PR');
  assert.equal(api.codigoCidade, '4106902');
});

test('emitenteRowToApiShape — inclui certDocument normalizado', () => {
  const api = emitenteRowToApiShape({
    cert_document: '12.345.678/0001-99',
    razao_social: 'ACME'
  });
  assert.equal(api.certDocument, '12345678000199');
  assert.equal(api.razaoSocial, 'ACME');
});

test('emitenteDbRowHasNfseData — só cert_document preenchido', () => {
  assert.equal(
    emitenteDbRowHasNfseData({
      cert_document: '12345678000199',
      razao_social: '',
      nome_fantasia: '',
      fiscal_email: '',
      regime_tributario: null,
      cep: '',
      tipo_logradouro: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      ibge_municipio: '',
      cidade: '',
      uf: '',
      optante_simples_nacional: true
    }),
    true
  );
});

test('emitenteDbRowHasNfseData — sem dados úteis', () => {
  assert.equal(
    emitenteDbRowHasNfseData({
      cert_document: '',
      razao_social: '   ',
      nome_fantasia: '',
      optante_simples_nacional: null
    }),
    false
  );
});

test('emitenteDbRowHasNfseData — só optante_simples_nacional não basta', () => {
  assert.equal(
    emitenteDbRowHasNfseData({
      cert_document: '',
      razao_social: '',
      nome_fantasia: '',
      fiscal_email: '',
      regime_tributario: null,
      cep: '',
      tipo_logradouro: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      ibge_municipio: '',
      cidade: '',
      uf: '',
      optante_simples_nacional: true
    }),
    false
  );
});

test('parseDocumentosAtivosMirrorValue normaliza json válido e rejeita inválido', () => {
  assert.deepStrictEqual(
    parseDocumentosAtivosMirrorValue({ nfse: true, nfe: false }),
    { nfse: true, nfe: false, nfce: false }
  );
  assert.strictEqual(parseDocumentosAtivosMirrorValue('{"nfse":true}'), null);
  assert.strictEqual(parseDocumentosAtivosMirrorValue(null), null);
});
