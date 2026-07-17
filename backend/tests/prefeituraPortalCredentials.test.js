import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPrefeituraPortalCredentialsPolicy,
  isPrefeituraLoginRequiredUpstreamMessage,
  PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE,
  sanitizePlugnotasEmpresaJsonForClientResponse
} from '../src/services/plugnotas/prefeituraPortalCredentials.js';

test('bloqueia login/senha no payload antes da chamada canónica', () => {
  const payload = {
    nfse: {
      ativo: true,
      config: {
        producao: true,
        prefeitura: { codigoIbge: '3550308', login: 'u', senha: 'p' }
      }
    }
  };
  assert.throws(
    () => applyPrefeituraPortalCredentialsPolicy(payload),
    (err) =>
      err.status === 400
      && err.errors?.plugnotasCode === PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE
      && String(err.message).includes('não aceita credenciais')
  );
});

test('objecto só com codigoIbge passa', () => {
  const payload = {
    nfse: {
      ativo: true,
      config: {
        producao: true,
        prefeitura: { codigoIbge: '3550308' }
      }
    }
  };
  applyPrefeituraPortalCredentialsPolicy(payload);
  assert.deepEqual(payload.nfse.config.prefeitura, { codigoIbge: '3550308' });
});

test('mesmo com campos vazios, a presença das chaves login/senha é bloqueada', () => {
  const payload = {
    nfse: {
      ativo: true,
      config: {
        producao: true,
        prefeitura: { codigoIbge: '3550308', login: '', senha: '   ' }
      }
    }
  };
  assert.throws(
    () => applyPrefeituraPortalCredentialsPolicy(payload),
    (err) => err.status === 400 && err.errors?.plugnotasCode === PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE
  );
});

test('classifica mensagem upstream de prefeitura.login obrigatório', () => {
  assert.equal(
    isPrefeituraLoginRequiredUpstreamMessage(
      'Falha na validação do JSON de Empresa: fields.nfse.config.prefeitura.login: Preenchimento obrigatório'
    ),
    true
  );
});

test('não classifica mensagens sem exigência explícita de prefeitura.login/senha', () => {
  assert.equal(
    isPrefeituraLoginRequiredUpstreamMessage(
      'Falha na validação do JSON de Empresa: fields.endereco.logradouro: Preenchimento obrigatório'
    ),
    false
  );
});

test('sanitizePlugnotasEmpresaJsonForClientResponse remove login/senha em prefeitura aninhada (NFR-ALNFB-01)', () => {
  const input = {
    message: 'OK',
    data: {
      cnpj: '17422651000172',
      nfse: {
        config: {
          prefeitura: { codigoIbge: '3550308', login: 'u', senha: 'p' }
        }
      }
    }
  };
  const out = /** @type {typeof input} */ (sanitizePlugnotasEmpresaJsonForClientResponse(input));
  assert.deepEqual(out.data.nfse.config.prefeitura, { codigoIbge: '3550308' });
  assert.equal(input.data.nfse.config.prefeitura.login, 'u');
});

test('trilho municipal válido: apply com flag on + auth municipal + modo municipal aceita e faz trim', () => {
  const payload = {
    nfse: {
      ativo: true,
      config: {
        producao: true,
        nfseNacional: false,
        consultaNfseNacional: false,
        prefeitura: { codigoIbge: '3550308', login: '  u  ', senha: '  p  ' }
      }
    }
  };
  applyPrefeituraPortalCredentialsPolicy(payload, {
    prefeituraCredentialsEnabled: true,
    municipalAuthRequired: true,
    attemptNfseMode: 'municipal',
    credState: {
      hasPartialKeys: false,
      hasNonEmptyCredentialPair: true,
      hasAnyPrefeituraCredentialKey: true
    }
  });
  assert.equal(payload.nfse.config.prefeitura.login, 'u');
  assert.equal(payload.nfse.config.prefeitura.senha, 'p');
});
