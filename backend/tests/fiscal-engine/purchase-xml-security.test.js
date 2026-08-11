import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSecurePurchaseXmlInput,
  detectXxePatterns,
  parseSecurePurchaseXmlDocument,
} from '../../src/fiscal-engine/acquisition/purchase-xml-security.js';
import { buildMinimalPurchaseNfeXml, buildTestChaveNfe } from './fixtures/purchase-xml-builder.js';

test('rejeita DOCTYPE e ENTITY (XXE)', () => {
  const xxe = '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>';
  assert.throws(() => assertSecurePurchaseXmlInput(xxe), /DOCTYPE/);
  assert.equal(detectXxePatterns(xxe), true);
});

test('rejeita XML malformado', () => {
  assert.throws(() => parseSecurePurchaseXmlDocument('<root><unclosed>'), /malformado|fatal/i);
});

test('rejeita XML acima do limite de tamanho', () => {
  const payload = '<?xml version="1.0"?><root>' + 'x'.repeat(200) + '</root>';
  assert.throws(
    () => assertSecurePurchaseXmlInput(payload, { maxBytes: 50 }),
    /limite/,
  );
});

test('aceita XML seguro mínimo', () => {
  const xml = buildMinimalPurchaseNfeXml({ chave: buildTestChaveNfe('11111111') });
  const text = assertSecurePurchaseXmlInput(xml);
  const doc = parseSecurePurchaseXmlDocument(text);
  assert.ok(doc.getElementsByTagName('infNFe').length);
});
