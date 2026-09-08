import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEmpresaPayloadFromEmitenteSnapshot,
  buildIssnetRtcNacionalEmpresaPatch,
} from '../src/services/plugnotas/plugnotas-mei-nfse-emit-prep.js';
import { applyPrefeituraPortalCredentialsPolicy } from '../src/services/plugnotas/prefeituraPortalCredentials.js';

test('buildEmpresaPayloadFromEmitenteSnapshot monta POST empresa NFS-e a partir do espelho local', () => {
  const payload = buildEmpresaPayloadFromEmitenteSnapshot(
    {
      certDocument: '65599761000157',
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      cep: '01001000',
      rpsLote: 1,
      rpsNumero: 3,
      rpsSerie: '1',
    },
    'cert-123',
    { nfse: true, nfe: false, nfce: false },
  );

  assert.equal(payload.cpfCnpj, '65599761000157');
  assert.equal(payload.certificado, 'cert-123');
  assert.equal(payload.nfse.ativo, true);
  assert.equal(payload.endereco.codigoCidade, '3550308');
  assert.deepEqual(payload.rps, { lote: 1, numeracao: [{ serie: '1', numero: 3 }] });
});

test('buildEmpresaPayloadFromEmitenteSnapshot tolera documentosAtivos null (espelho ausente)', () => {
  const payload = buildEmpresaPayloadFromEmitenteSnapshot(
    {
      certDocument: '65599761000157',
      razaoSocial: 'Empresa Teste LTDA',
      logradouro: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      codigoCidade: '3550308',
      descricaoCidade: 'São Paulo',
      estado: 'SP',
      cep: '01001000',
    },
    'cert-123',
    null,
  );

  assert.equal(payload.nfse.ativo, true);
});

test('buildIssnetRtcNacionalEmpresaPatch migra Ribeirão Preto sem credenciais municipais', () => {
  const empresaJson = {
    endereco: { codigoCidade: '3543402' },
    nfse: {
      ativo: true,
      config: {
        nfseNacional: false,
        prefeitura: {
          codigoIbge: '3543402',
          login: 'usuario-pref',
          senha: 'senha-pref',
        },
      },
    },
  };

  const patch = buildIssnetRtcNacionalEmpresaPatch('43581555000187', empresaJson);
  assert.ok(patch);
  assert.equal(patch.cpfCnpj, '43581555000187');
  assert.equal(patch.nfse.config.nfseNacional, true);
  assert.equal(patch.nfse.config.consultaNfseNacional, true);
  assert.deepEqual(patch.nfse.config.prefeitura, { codigoIbge: '3543402' });
  assert.equal('login' in (patch.nfse.config.prefeitura || {}), false);
  assert.equal('senha' in (patch.nfse.config.prefeitura || {}), false);

  assert.doesNotThrow(() => applyPrefeituraPortalCredentialsPolicy(patch, {
    prefeituraCredentialsEnabled: false,
    municipalAuthRequired: true,
    attemptNfseMode: 'nacional',
  }));
});

test('buildIssnetRtcNacionalEmpresaPatch retorna null se já estiver em modo nacional', () => {
  const patch = buildIssnetRtcNacionalEmpresaPatch('43581555000187', {
    endereco: { codigoCidade: '3543402' },
    nfse: { config: { nfseNacional: true } },
  });
  assert.equal(patch, null);
});
