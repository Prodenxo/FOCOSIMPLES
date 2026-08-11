/** Razões detalhadas da verificação de assinatura XML NF-e. */
export const SIGNATURE_REASON = Object.freeze({
  SIGNATURE_ABSENT: 'SIGNATURE_ABSENT',
  VERIFICATION_ERROR: 'VERIFICATION_ERROR',
  CRYPTO_INVALID: 'CRYPTO_INVALID',
  CRYPTO_VALID_TRUST_UNVERIFIED: 'CRYPTO_VALID_TRUST_UNVERIFIED',
  REFERENCE_URI_MISMATCH: 'REFERENCE_URI_MISMATCH',
  CERT_EXPIRED: 'CERT_EXPIRED',
  CERT_EMITTER_MISMATCH: 'CERT_EMITTER_MISMATCH',
  CERT_VALIDITY_REFERENCE_UNAVAILABLE: 'CERT_VALIDITY_REFERENCE_UNAVAILABLE',
  ALGORITHM_UNSUPPORTED: 'ALGORITHM_UNSUPPORTED',
});

/** Algoritmos aceitos no padrão NF-e 4.00 (subset conservador). */
export const NFE_ALLOWED_SIGNATURE_ALGORITHMS = Object.freeze([
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
]);

export const NFE_ALLOWED_DIGEST_ALGORITHMS = Object.freeze([
  'http://www.w3.org/2001/04/xmlenc#sha256',
  'http://www.w3.org/2000/09/xmldsig#sha1',
]);

export const NFE_ALLOWED_TRANSFORM_ALGORITHMS = Object.freeze([
  'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  'http://www.w3.org/2001/10/xml-exc-c14n#',
  'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
]);
