import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateEmpresaCadastroMunicipioPreflight,
  resolveEmpresaCadastroMunicipioRuntimeDecision
} from '../src/services/plugnotas/empresa-cadastro-runtime-decision.js';

/**
 * Regressão FR-REC500 / FR-PFLNAT — motor de decisão do preflight municipal.
 * PFLNAT: com `padraoNacionalEnabled` e modo nacional default, o híbrido (login/senha no metadado)
 * concede `success_nacional` antes de `prefeitura_login_required_blocked`.
 *
 * `prefeitura_login_required_blocked` permanece quando não há sinal nacional suficiente
 * (ex.: `padraoNacionalEnabled !== true`) e o preflight exige credenciais municipais.
 */

const preflightFixture = (overrides = {}) => ({
  consulted: true,
  codigoIbge: '5002704',
  environment: 'producao',
  padraoNacionalEnabled: true,
  requiresLogin: false,
  requiresSenha: false,
  ...overrides
});

test('FR-PFLNAT-04 / REC500: IBGE 5002704 híbrido (nacional+login) → success_nacional; metadados preservados', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({ requiresLogin: true, requiresSenha: false })
  );
  assert.equal(d.scenario, 'success_nacional');
  assert.equal(d.padraoNacionalEnabled, true);
  assert.equal(d.requiresLogin, true);
  assert.equal(d.requiresSenha, false);
  assert.equal(d.upstreamCallSkipped, false);
});

test('FR-PFLNAT-04 / REC500: preflight híbrido nacional+senha → success_nacional', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({ requiresLogin: false, requiresSenha: true })
  );
  assert.equal(d.scenario, 'success_nacional');
  assert.equal(d.padraoNacionalEnabled, true);
});

test('REC500 P2: IBGE 5002704 híbrido — mesmo cenário canónico MEI (override PFLNAT)', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({ requiresLogin: true })
  );
  assert.equal(d.scenario, 'success_nacional');
});

test('REC500 P2: outro município só com caminho nacional elegível → success_nacional (brownfield)', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({
      codigoIbge: '3106200',
      requiresLogin: false,
      requiresSenha: false
    })
  );
  assert.equal(d.scenario, 'success_nacional');
  assert.equal(d.upstreamCallSkipped, false);
});

test('FR-PFLNAT-02: município com híbrido + nacional disponível → success_nacional (não é bloqueio por login)', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({
      codigoIbge: '3550308',
      requiresLogin: true,
      padraoNacionalEnabled: true
    })
  );
  assert.equal(d.scenario, 'success_nacional');
});

test('FR-PFLNAT-02: sem nacional elegível + auth municipal + governança default → prefeitura_login_required_blocked', () => {
  const d = evaluateEmpresaCadastroMunicipioPreflight(
    preflightFixture({
      codigoIbge: '3550308',
      requiresLogin: true,
      padraoNacionalEnabled: false
    })
  );
  assert.equal(d.scenario, 'prefeitura_login_required_blocked');
  assert.equal(d.upstreamCallSkipped, true);
});

const credVazia = {
  hasPartialKeys: false,
  hasNonEmptyCredentialPair: false,
  hasAnyPrefeituraCredentialKey: false
};

/** Par credencial não vazio (governança) — sem chaves parciais. */
const credParValido = {
  hasPartialKeys: false,
  hasNonEmptyCredentialPair: true,
  hasAnyPrefeituraCredentialKey: true
};

/**
 * PFLNAT arquitetura §4: com nacional OK e modo nacional, ainda bloqueia se houver par credencial
 * e a política municipal estiver desligada (trilho municipal indisponível).
 */
test('FR-PFLNAT §4: natOk + nacional + authRequired + par credencial + prefeituraCredentialsEnabled false → prefeitura_login_required_blocked', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '5002704',
      requiresLogin: true,
      padraoNacionalEnabled: true
    }),
    {
      prefeituraCredentialsEnabled: false,
      attemptNfseMode: 'nacional',
      credState: credParValido
    }
  );
  assert.equal(allowUpstream, false);
  assert.equal(runtimeDecision.scenario, 'prefeitura_login_required_blocked');
  assert.equal(runtimeDecision.upstreamCallSkipped, true);
  assert.equal(runtimeDecision.padraoNacionalEnabled, true);
  assert.equal(runtimeDecision.requiresLogin, true);
});

/**
 * FR-ALNFB Story 1.1 — matriz §12.2 / `resolveEmpresaCadastroMunicipioRuntimeDecision` (governança + flag).
 */
test('FR-ALNFB 1.1 / PFLNAT: auth municipal + nacional disponível + flag off + sem credenciais → success_nacional', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '3550308',
      requiresLogin: true,
      padraoNacionalEnabled: true
    }),
    {
      prefeituraCredentialsEnabled: false,
      attemptNfseMode: 'nacional',
      credState: credVazia
    }
  );
  assert.equal(allowUpstream, true);
  assert.equal(runtimeDecision.scenario, 'success_nacional');
  assert.equal(runtimeDecision.upstreamCallSkipped, false);
  assert.equal(runtimeDecision.environment, 'producao');
});

test('FR-ALNFB 1.1 / PFLNAT: auth municipal + nacional disponível + flag on + sem credenciais → success_nacional', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '3550308',
      requiresLogin: true,
      padraoNacionalEnabled: true
    }),
    {
      prefeituraCredentialsEnabled: true,
      attemptNfseMode: 'nacional',
      credState: credVazia
    }
  );
  assert.equal(allowUpstream, true);
  assert.equal(runtimeDecision.scenario, 'success_nacional');
  assert.equal(runtimeDecision.upstreamCallSkipped, false);
  assert.equal(runtimeDecision.consultedMunicipio, true);
  assert.equal(runtimeDecision.codigoIbge, '3550308');
});

test('FR-PFLNAT-02: auth municipal + sem nacional + flag on + sem credenciais → prefeitura_login_required_fallback_available', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '3550308',
      requiresLogin: true,
      padraoNacionalEnabled: false
    }),
    {
      prefeituraCredentialsEnabled: true,
      attemptNfseMode: 'nacional',
      credState: credVazia
    }
  );
  assert.equal(allowUpstream, false);
  assert.equal(runtimeDecision.scenario, 'prefeitura_login_required_fallback_available');
  assert.equal(runtimeDecision.upstreamCallSkipped, true);
  assert.equal(runtimeDecision.consultedMunicipio, true);
  assert.equal(runtimeDecision.codigoIbge, '3550308');
});

test('FR-ALNFB 1.1: nacional puro + flag on → success_nacional (allowUpstream)', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '3106200',
      requiresLogin: false,
      requiresSenha: false,
      padraoNacionalEnabled: true
    }),
    {
      prefeituraCredentialsEnabled: true,
      attemptNfseMode: 'nacional',
      credState: credVazia
    }
  );
  assert.equal(allowUpstream, true);
  assert.equal(runtimeDecision.scenario, 'success_nacional');
  assert.equal(runtimeDecision.upstreamCallSkipped, false);
});

test('FR-ALNFB 1.1: prefeitura_ibge_apenas_insuficiente_dp02 não conflitua com fallback (sem auth explícita)', () => {
  const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflightFixture({
      codigoIbge: '3106200',
      requiresLogin: false,
      requiresSenha: false,
      padraoNacionalEnabled: false
    }),
    {
      prefeituraCredentialsEnabled: true,
      attemptNfseMode: 'nacional',
      credState: credVazia
    }
  );
  assert.equal(allowUpstream, false);
  assert.equal(runtimeDecision.scenario, 'prefeitura_ibge_apenas_insuficiente_dp02');
});
