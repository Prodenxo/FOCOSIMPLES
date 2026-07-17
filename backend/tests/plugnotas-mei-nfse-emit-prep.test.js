import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEmpresaPayloadFromEmitenteSnapshot } from '../src/services/plugnotas/plugnotas-mei-nfse-emit-prep.js';

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
