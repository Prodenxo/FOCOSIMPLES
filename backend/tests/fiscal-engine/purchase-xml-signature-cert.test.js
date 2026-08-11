import test from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import {
  compareCertEmitterDocument,
  validateCertificateTemporalAndEmitter,
  resolveCertificateReferenceTime,
  buildCertificateValidationSnapshot,
} from '../../src/fiscal-engine/acquisition/purchase-xml-signature.js';
import { SIGNATURE_REASON } from '../../src/fiscal-engine/acquisition/signature-constants.js';
import { AUTHORIZATION_STATUS, SIGNATURE_STATUS } from '../../src/fiscal-engine/acquisition/constants.js';

const certBase64FromPem = (pem) => pem
  .replace('-----BEGIN CERTIFICATE-----', '')
  .replace('-----END CERTIFICATE-----', '')
  .replace(/\s+/g, '');

const generateTestCertBase64 = ({ subjectDigits, notBefore, notAfter }) => {
  const keys = forge.pki.rsa.generateKeyPair(512);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  cert.setSubject([{ name: 'commonName', value: `CN=${subjectDigits}, O=Test Emitter` }]);
  cert.setIssuer([{ name: 'commonName', value: 'Test CA' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return certBase64FromPem(forge.pki.certificateToPem(cert));
};

test('CNPJ-Base — mesma raiz, filiais diferentes não gera CERT_EMITTER_MISMATCH', () => {
  const result = compareCertEmitterDocument({
    certDoc: { type: 'CNPJ', value: '12345678000199' },
    emitenteCnpj: '12345678000288',
  });
  assert.equal(result.ok, true);
});

test('CNPJ-Base — raízes diferentes => CERT_EMITTER_MISMATCH', () => {
  const result = compareCertEmitterDocument({
    certDoc: { type: 'CNPJ', value: '12345678000199' },
    emitenteCnpj: '87654321000155',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CERT_EMITTER_MISMATCH);
});

test('CPF compatível => ok neste critério', () => {
  const result = compareCertEmitterDocument({
    certDoc: { type: 'CPF', value: '12345678901' },
    emitenteCpf: '12345678901',
  });
  assert.equal(result.ok, true);
});

test('CPF divergente => CERT_EMITTER_MISMATCH', () => {
  const result = compareCertEmitterDocument({
    certDoc: { type: 'CPF', value: '12345678901' },
    emitenteCpf: '10987654321',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CERT_EMITTER_MISMATCH);
});

test('validade — certificado expirado hoje mas válido no dhRecbto => não INVALID por validade', () => {
  const certB64 = generateTestCertBase64({
    subjectDigits: '12345678000199',
    notBefore: new Date('2024-01-01T00:00:00Z'),
    notAfter: new Date('2024-12-31T23:59:59Z'),
  });

  const result = validateCertificateTemporalAndEmitter(certB64, {
    emitenteCnpj: '12345678000288',
    dhRecbto: '2024-06-15T10:00:00-03:00',
    dhEmi: '2024-06-15T09:00:00-03:00',
    authorizationStatus: AUTHORIZATION_STATUS.AUTHORIZED,
  });

  assert.equal(result.ok, true);
  assert.equal(result.certificateValidation.validAtReferenceTime, true);
  assert.equal(result.certificateValidation.referenceTimeSource, 'protNFe.infProt.dhRecbto');
});

test('validade — certificado já vencido no dhRecbto => INVALID', () => {
  const certB64 = generateTestCertBase64({
    subjectDigits: '12345678000199',
    notBefore: new Date('2023-01-01T00:00:00Z'),
    notAfter: new Date('2023-12-31T23:59:59Z'),
  });

  const result = validateCertificateTemporalAndEmitter(certB64, {
    emitenteCnpj: '12345678000199',
    dhRecbto: '2024-06-15T10:00:00-03:00',
    authorizationStatus: AUTHORIZATION_STATUS.AUTHORIZED,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CERT_EXPIRED);
  assert.equal(result.certificateValidation.validAtReferenceTime, false);
});

test('validade — certificado ainda não válido no dhRecbto => INVALID', () => {
  const certB64 = generateTestCertBase64({
    subjectDigits: '12345678000199',
    notBefore: new Date('2025-01-01T00:00:00Z'),
    notAfter: new Date('2025-12-31T23:59:59Z'),
  });

  const result = validateCertificateTemporalAndEmitter(certB64, {
    emitenteCnpj: '12345678000199',
    dhRecbto: '2024-06-15T10:00:00-03:00',
    authorizationStatus: AUTHORIZATION_STATUS.AUTHORIZED,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CERT_EXPIRED);
  assert.equal(result.certificateValidation.validAtReferenceTime, false);
});

test('validade — referenceTime confiável ausente => UNVERIFIED (não INVALID por suposição)', () => {
  const certB64 = generateTestCertBase64({
    subjectDigits: '12345678000199',
    notBefore: new Date('2020-01-01T00:00:00Z'),
    notAfter: new Date('2021-12-31T23:59:59Z'),
  });

  const result = validateCertificateTemporalAndEmitter(certB64, {
    emitenteCnpj: '12345678000199',
    authorizationStatus: AUTHORIZATION_STATUS.UNKNOWN,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, SIGNATURE_REASON.CERT_VALIDITY_REFERENCE_UNAVAILABLE);
  assert.equal(result.certificateValidation.referenceTime, null);
  assert.equal(result.certificateValidation.validAtReferenceTime, null);
});

test('resolveCertificateReferenceTime prioriza dhRecbto em NF-e autorizada', () => {
  const resolved = resolveCertificateReferenceTime({
    dhRecbto: '2024-06-15T10:00:00-03:00',
    dhEmi: '2024-06-15T09:00:00-03:00',
    authorizationStatus: AUTHORIZATION_STATUS.AUTHORIZED,
  });
  assert.equal(resolved.referenceTimeSource, 'protNFe.infProt.dhRecbto');
  assert.ok(resolved.referenceTime instanceof Date);
});

test('buildCertificateValidationSnapshot inclui campos exigidos', () => {
  const certB64 = generateTestCertBase64({
    subjectDigits: '12345678000199',
    notBefore: new Date('2024-01-01T00:00:00Z'),
    notAfter: new Date('2024-12-31T23:59:59Z'),
  });
  const pem = `-----BEGIN CERTIFICATE-----\n${certB64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
  const cert = forge.pki.certificateFromPem(pem);
  const ref = new Date('2024-06-15T13:00:00.000Z');
  const snapshot = buildCertificateValidationSnapshot(cert, ref, 'protNFe.infProt.dhRecbto', '2024-06-15T09:00:00-03:00');

  assert.equal(snapshot.referenceTimeSource, 'protNFe.infProt.dhRecbto');
  assert.equal(snapshot.validAtReferenceTime, true);
  assert.ok(snapshot.validFrom);
  assert.ok(snapshot.validTo);
  assert.equal(snapshot.dhEmi, '2024-06-15T09:00:00-03:00');
});
