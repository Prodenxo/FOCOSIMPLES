import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCnpjMeiEligibility,
  MEI_CERT_CNPJ_NOT_MEI,
  MEI_CERT_CPF_NOT_ALLOWED,
} from '../src/services/mei-certificate-eligibility.service.js';

test('classifyCnpjMeiEligibility: opcao_mei true é o único caso permitido', () => {
  const verdict = classifyCnpjMeiEligibility({ opcaoMei: true, situacaoCadastral: 'ATIVA' });
  assert.equal(verdict.eligible, true);
  assert.equal(verdict.signal, 'opcao_mei_true');
});

test('classifyCnpjMeiEligibility: opcao_mei false bloqueia', () => {
  const verdict = classifyCnpjMeiEligibility({ opcaoMei: false, situacaoCadastral: 'ATIVA' });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.signal, 'opcao_mei_false');
});

test('classifyCnpjMeiEligibility: Simples Nacional sem MEI bloqueia', () => {
  const verdict = classifyCnpjMeiEligibility({
    opcaoMei: false,
    opcaoSimples: true,
    situacaoCadastral: 'ATIVA',
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.signal, 'opcao_mei_false');
});

test('classifyCnpjMeiEligibility: Simples sem flag MEI explícita bloqueia', () => {
  const verdict = classifyCnpjMeiEligibility({
    opcaoSimples: true,
    situacaoCadastral: 'ATIVA',
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.signal, 'simples_sem_mei');
});

test('classifyCnpjMeiEligibility: empresário individual sem opcao_mei bloqueia', () => {
  const verdict = classifyCnpjMeiEligibility({
    codigoNaturezaJuridica: 2135,
    situacaoCadastral: 'ATIVA',
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.signal, 'mei_nao_confirmado');
});

test('classifyCnpjMeiEligibility: LTDA bloqueia', () => {
  const verdict = classifyCnpjMeiEligibility({
    codigoNaturezaJuridica: 2062,
    opcaoMei: false,
    situacaoCadastral: 'ATIVA',
  });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.signal, 'opcao_mei_false');
});

test('assertMeiCertificateEligible bloqueia e-CPF (11 dígitos)', async () => {
  process.env.MEI_CERT_ENFORCE_MEI_CNPJ = 'true';
  const { assertMeiCertificateEligible } = await import(
    '../src/services/mei-certificate-eligibility.service.js'
  );

  await assert.rejects(
    () => assertMeiCertificateEligible('12345678901'),
    (err) => {
      assert.equal(err.errors?.code, MEI_CERT_CPF_NOT_ALLOWED);
      return true;
    }
  );
});

test('assertMeiCertificateEligible bloqueia CNPJ Simples sem MEI', async () => {
  process.env.MEI_CERT_ENFORCE_MEI_CNPJ = 'true';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      razao_social: 'EMPRESA SIMPLES LTDA',
      opcao_pelo_mei: false,
      opcao_pelo_simples: true,
      descricao_situacao_cadastral: 'ATIVA',
      codigo_natureza_juridica: 2062,
    }),
  });

  try {
    const { assertMeiCertificateEligible } = await import(
      '../src/services/mei-certificate-eligibility.service.js'
    );
    await assert.rejects(
      () => assertMeiCertificateEligible('17422651000172'),
      (err) => {
        assert.equal(err.errors?.code, MEI_CERT_CNPJ_NOT_MEI);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('assertMeiCertificateEligible permite somente opcao_mei true', async () => {
  process.env.MEI_CERT_ENFORCE_MEI_CNPJ = 'true';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      razao_social: '65.133.609 DANIEL DA SILVA SANTOS',
      opcao_pelo_mei: true,
      opcao_pelo_simples: true,
      descricao_situacao_cadastral: 'ATIVA',
      codigo_natureza_juridica: 2135,
    }),
  });

  try {
    const { assertMeiCertificateEligible } = await import(
      '../src/services/mei-certificate-eligibility.service.js'
    );
    const result = await assertMeiCertificateEligible('17422651000172');
    assert.equal(result.signal, 'opcao_mei_true');
  } finally {
    global.fetch = originalFetch;
  }
});
