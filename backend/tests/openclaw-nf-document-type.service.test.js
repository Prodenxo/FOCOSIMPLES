import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferOpenclawNfDocumentType,
  rerouteOpenclawNfseProductToNfe,
} from '../src/services/openclaw-nf-document-type.service.js';

test('camiseta masculina é NF-e, não NFS-e', () => {
  assert.equal(
    inferOpenclawNfDocumentType({ discriminacao: 'camiseta masculina' }),
    'NFE',
  );
  const routed = rerouteOpenclawNfseProductToNfe('emit_nfse', {
    tomadorNome: 'Arthur Ferreira',
    discriminacao: 'camiseta masculina',
    valor: 10,
    confirm: true,
  });
  assert.equal(routed.action, 'emit_nfe');
  assert.equal(routed.reroutedFrom, 'emit_nfse');
  assert.equal(routed.payload.destinatarioNome, 'Arthur Ferreira');
  assert.equal(routed.payload.produtoNome, 'camiseta masculina');
  assert.equal(routed.payload.documentType, 'NFE');
});

test('preview_nfse de camisa vira preview_nfe', () => {
  const routed = rerouteOpenclawNfseProductToNfe('preview_nfse', {
    tomadorNome: 'Leonardo',
    produtoNome: 'camisa branca',
    valor: 5,
  });
  assert.equal(routed.action, 'preview_nfe');
});

test('serviço explícito continua NFS-e', () => {
  assert.equal(
    inferOpenclawNfDocumentType({ discriminacao: 'consultoria contábil' }),
    'NFSE',
  );
  const routed = rerouteOpenclawNfseProductToNfe('emit_nfse', {
    tomadorNome: 'Arthur Ferreira',
    discriminacao: 'nota de serviço',
    valor: 10,
  });
  assert.equal(routed.action, 'emit_nfse');
  assert.equal(routed.reroutedFrom, undefined);
});

test('ação que não é nota não muda', () => {
  const routed = rerouteOpenclawNfseProductToNfe('get_saldo', {
    discriminacao: 'camiseta',
  });
  assert.equal(routed.action, 'get_saldo');
});
