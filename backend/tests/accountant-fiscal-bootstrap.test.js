import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapCompanyFiscalProfilesFromCertificates,
  listCertificateEmittersForTenant,
  __resetAccountantFiscalBootstrapDepsForTests,
  __setAccountantFiscalBootstrapDepsForTests,
} from '../src/services/accountant/accountant-fiscal-bootstrap.service.js';
import { FISCAL_PROFILE_STATUS } from '../src/fiscal-engine/fiscal-configuration/constants.js';

const savedProfiles = [];

test.beforeEach(() => {
  savedProfiles.length = 0;
  __resetAccountantFiscalBootstrapDepsForTests();
});

test.afterEach(() => {
  __resetAccountantFiscalBootstrapDepsForTests();
});

test('listCertificateEmittersForTenant normaliza CNPJ, CRT e UF', async () => {
  __setAccountantFiscalBootstrapDepsForTests({
    query: async () => ({
      rows: [{
        establishment_id: '12345678000199',
        crt: '1',
        optante_simples_nacional: true,
        uf: 'sp',
        ibge_municipio: '3550308',
        razao_social: 'Empresa Teste LTDA',
        nome_fantasia: 'Empresa Teste',
      }],
    }),
  });

  const emitters = await listCertificateEmittersForTenant('tenant-1');
  assert.equal(emitters.length, 1);
  assert.equal(emitters[0].establishmentId, '12345678000199');
  assert.equal(emitters[0].crt, 1);
  assert.equal(emitters[0].taxRegime, 'SIMPLES_NACIONAL');
  assert.equal(emitters[0].issuerUf, 'SP');
  assert.equal(emitters[0].municipalityCode, '3550308');
});

test('bootstrapCompanyFiscalProfilesFromCertificates cria perfil DRAFT quando ausente', async () => {
  __setAccountantFiscalBootstrapDepsForTests({
    query: async () => ({
      rows: [{
        establishment_id: '12345678000199',
        crt: '1',
        optante_simples_nacional: true,
        uf: 'RJ',
        ibge_municipio: '3304557',
        razao_social: 'Cliente ME',
        nome_fantasia: null,
      }],
    }),
    getCompanyFiscalProfile: async () => null,
    saveCompanyFiscalProfile: async (profile) => {
      savedProfiles.push(profile);
      return profile;
    },
  });

  const inserted = await bootstrapCompanyFiscalProfilesFromCertificates('tenant-abc');
  assert.equal(inserted, 1);
  assert.equal(savedProfiles.length, 1);
  assert.equal(savedProfiles[0].tenantId, 'tenant-abc');
  assert.equal(savedProfiles[0].establishmentId, '12345678000199');
  assert.equal(savedProfiles[0].crt, 1);
  assert.equal(savedProfiles[0].issuerUf, 'RJ');
  assert.equal(savedProfiles[0].status, FISCAL_PROFILE_STATUS.DRAFT);
});

test('bootstrapCompanyFiscalProfilesFromCertificates não sobrescreve perfil existente', async () => {
  __setAccountantFiscalBootstrapDepsForTests({
    query: async () => ({
      rows: [{
        establishment_id: '12345678000199',
        crt: '1',
        optante_simples_nacional: true,
        uf: 'RJ',
        ibge_municipio: null,
        razao_social: 'Cliente ME',
        nome_fantasia: null,
      }],
    }),
    getCompanyFiscalProfile: async () => ({ id: 'existing', status: 'ACTIVE' }),
    saveCompanyFiscalProfile: async (profile) => {
      savedProfiles.push(profile);
      return profile;
    },
  });

  const inserted = await bootstrapCompanyFiscalProfilesFromCertificates('tenant-abc');
  assert.equal(inserted, 0);
  assert.equal(savedProfiles.length, 0);
});
