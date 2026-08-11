/**
 * Validação criptográfica da assinatura XML NF-e.
 * SHA-256 do upload = integridade/idempotência — NÃO autenticidade.
 */
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { AUTHORIZATION_STATUS, SIGNATURE_STATUS } from './constants.js';
import {
  SIGNATURE_REASON,
  NFE_ALLOWED_SIGNATURE_ALGORITHMS,
  NFE_ALLOWED_DIGEST_ALGORITHMS,
} from './signature-constants.js';

const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

const localName = (node) => String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');

const findFirstByLocalName = (root, name) => {
  if (!root) return null;
  const stack = [root];
  while (stack.length) {
    const node = stack.shift();
    if (localName(node) === name) return node;
    for (let i = 0; i < (node.childNodes?.length || 0); i += 1) {
      const child = node.childNodes.item(i);
      if (child) stack.push(child);
    }
  }
  return null;
};

const textContentOf = (root, name) => {
  const el = findFirstByLocalName(root, name);
  return el?.textContent?.trim() || null;
};

const parseXmlDocument = (xmlText) => {
  const parser = new DOMParser();
  return parser.parseFromString(String(xmlText || ''), 'text/xml');
};

const normalizeDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * @param {Document} doc
 */
export const extractSignatureBlock = (doc) => {
  const signatureEl = findFirstByLocalName(doc, 'Signature');
  if (!signatureEl) return null;
  return {
    element: signatureEl,
    referenceUri: signatureEl.getAttribute?.('URI')
      || findFirstByLocalName(signatureEl, 'Reference')?.getAttribute?.('URI')
      || null,
    digestValue: textContentOf(signatureEl, 'DigestValue'),
    signatureValue: textContentOf(signatureEl, 'SignatureValue'),
    signatureMethod: textContentOf(signatureEl, 'SignatureMethod')?.replace(/^.*#/, '')
      || findFirstByLocalName(signatureEl, 'SignatureMethod')?.getAttribute?.('Algorithm'),
    digestMethod: findFirstByLocalName(signatureEl, 'DigestMethod')?.getAttribute?.('Algorithm'),
    x509Certificate: textContentOf(signatureEl, 'X509Certificate'),
    transforms: [],
  };
};

/**
 * @param {string} xmlText
 * @param {string} infNfeId
 */
export const extractNfeDigestValue = (xmlText, infNfeId) => {
  const doc = parseXmlDocument(xmlText);
  const block = extractSignatureBlock(doc);
  if (!block?.digestValue) return null;
  const expectedRef = `#${String(infNfeId || '').trim()}`;
  if (block.referenceUri && block.referenceUri !== expectedRef) return null;
  return block.digestValue.replace(/\s+/g, '');
};

const normalizeBase64 = (value) => String(value || '').replace(/\s+/g, '');

const certPemFromBase64 = (b64) => {
  const clean = normalizeBase64(b64);
  if (!clean) return null;
  const lines = clean.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
};

/**
 * @param {string} certPem
 * @returns {{ type: 'CNPJ'|'CPF'|null, value: string|null }}
 */
export const extractEmitterDocumentFromCert = (certPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const subject = cert.subject.attributes
      .map((a) => `${a.shortName}=${a.value}`)
      .join(',');
    const cnpjMatch = subject.match(/(\d{14})/);
    if (cnpjMatch) {
      return { type: 'CNPJ', value: cnpjMatch[1] };
    }
    const cpfMatch = subject.match(/(\d{11})/);
    if (cpfMatch) {
      return { type: 'CPF', value: cpfMatch[1] };
    }
    return { type: null, value: null };
  } catch {
    return { type: null, value: null };
  }
};

/**
 * Compara documento do certificado com emitente NF-e (CNPJ-Base ou CPF integral).
 * @param {{ certDoc: { type: string|null, value: string|null }, emitenteCnpj?: string|null, emitenteCpf?: string|null }} params
 */
export const compareCertEmitterDocument = ({ certDoc, emitenteCnpj, emitenteCpf }) => {
  const emitCnpj = emitenteCnpj ? normalizeDigits(emitenteCnpj, 14) : null;
  const emitCpf = emitenteCpf ? normalizeDigits(emitenteCpf, 11) : null;

  if (certDoc.type === 'CNPJ' && emitCnpj?.length === 14) {
    const certBase = certDoc.value.slice(0, 8);
    const emitBase = emitCnpj.slice(0, 8);
    if (certBase !== emitBase) {
      return {
        ok: false,
        reasonCode: SIGNATURE_REASON.CERT_EMITTER_MISMATCH,
        reason: 'CNPJ-Base do certificado difere do emitente da NF-e',
      };
    }
    return { ok: true };
  }

  if (certDoc.type === 'CPF' && emitCpf?.length === 11) {
    if (certDoc.value !== emitCpf) {
      return {
        ok: false,
        reasonCode: SIGNATURE_REASON.CERT_EMITTER_MISMATCH,
        reason: 'CPF do certificado difere do emitente da NF-e',
      };
    }
    return { ok: true };
  }

  if (certDoc.type === 'CNPJ' && emitCpf?.length === 11) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.CERT_EMITTER_MISMATCH,
      reason: 'Certificado CNPJ incompatível com emitente CPF',
    };
  }

  if (certDoc.type === 'CPF' && emitCnpj?.length === 14) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.CERT_EMITTER_MISMATCH,
      reason: 'Certificado CPF incompatível com emitente CNPJ',
    };
  }

  return { ok: true };
};

const parseNfeDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * @param {{ dhRecbto?: string|null, dhEmi?: string|null, authorizationStatus?: string|null }} params
 */
export const resolveCertificateReferenceTime = ({
  dhRecbto,
  dhEmi,
  authorizationStatus,
}) => {
  const isAuthorized = authorizationStatus === AUTHORIZATION_STATUS.AUTHORIZED;
  if (isAuthorized && dhRecbto) {
    const referenceTime = parseNfeDateTime(dhRecbto);
    if (referenceTime) {
      return {
        referenceTime,
        referenceTimeSource: 'protNFe.infProt.dhRecbto',
        dhEmi: dhEmi || null,
      };
    }
  }
  return {
    referenceTime: null,
    referenceTimeSource: null,
    dhEmi: dhEmi || null,
  };
};

/**
 * @param {import('node-forge').pki.Certificate} cert
 * @param {Date|null} referenceTime
 * @param {string|null} referenceTimeSource
 * @param {string|null} dhEmi
 */
export const buildCertificateValidationSnapshot = (cert, referenceTime, referenceTimeSource, dhEmi) => {
  const validFrom = cert.validity.notBefore.toISOString();
  const validTo = cert.validity.notAfter.toISOString();
  const validAtReferenceTime = referenceTime
    ? referenceTime >= cert.validity.notBefore && referenceTime <= cert.validity.notAfter
    : null;

  return {
    referenceTime: referenceTime?.toISOString() ?? null,
    referenceTimeSource,
    validFrom,
    validTo,
    validAtReferenceTime,
    dhEmi: dhEmi || null,
  };
};

/**
 * @param {string} certB64
 * @param {{ emitenteCnpj?: string|null, emitenteCpf?: string|null, dhRecbto?: string|null, dhEmi?: string|null, authorizationStatus?: string|null }} [context]
 */
export const validateCertificateTemporalAndEmitter = (certB64, context = {}) => {
  const pem = certPemFromBase64(certB64);
  if (!pem) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.VERIFICATION_ERROR,
      reason: 'Certificado X509 ausente ou ilegível',
    };
  }

  try {
    const cert = forge.pki.certificateFromPem(pem);
    const reference = resolveCertificateReferenceTime(context);
    const certificateValidation = buildCertificateValidationSnapshot(
      cert,
      reference.referenceTime,
      reference.referenceTimeSource,
      reference.dhEmi,
    );

    if (!reference.referenceTime) {
      return {
        ok: false,
        reasonCode: SIGNATURE_REASON.CERT_VALIDITY_REFERENCE_UNAVAILABLE,
        reason: 'Referência temporal confiável ausente — validade do certificado não conclusiva',
        pem,
        certificateValidation,
      };
    }

    if (!certificateValidation.validAtReferenceTime) {
      return {
        ok: false,
        reasonCode: SIGNATURE_REASON.CERT_EXPIRED,
        reason: 'Certificado X509 fora da validade na data de referência fiscal',
        pem,
        certificateValidation,
      };
    }

    const certDoc = extractEmitterDocumentFromCert(pem);
    const emitterCheck = compareCertEmitterDocument({
      certDoc,
      emitenteCnpj: context.emitenteCnpj,
      emitenteCpf: context.emitenteCpf,
    });
    if (!emitterCheck.ok) {
      return {
        ok: false,
        reasonCode: emitterCheck.reasonCode,
        reason: emitterCheck.reason,
        pem,
        certificateValidation,
      };
    }

    return { ok: true, pem, certificateValidation };
  } catch (err) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.VERIFICATION_ERROR,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
};

const validateSignatureAlgorithms = (block) => {
  if (block.signatureMethod && !NFE_ALLOWED_SIGNATURE_ALGORITHMS.includes(block.signatureMethod)) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.ALGORITHM_UNSUPPORTED,
      reason: `Algoritmo de assinatura não suportado: ${block.signatureMethod}`,
    };
  }
  if (block.digestMethod && !NFE_ALLOWED_DIGEST_ALGORITHMS.includes(block.digestMethod)) {
    return {
      ok: false,
      reasonCode: SIGNATURE_REASON.ALGORITHM_UNSUPPORTED,
      reason: `Algoritmo de digest não suportado: ${block.digestMethod}`,
    };
  }
  return { ok: true };
};

const verifyIcpBrasilTrustChain = (_pem) => {
  // Cadeia ICP-Brasil não validada nesta fase — não promover a VALID.
  return { ok: false, reason: 'Cadeia ICP-Brasil não verificada nesta fase' };
};

const buildCertFailureResult = (certCheck) => {
  const isInvalid = [
    SIGNATURE_REASON.CERT_EXPIRED,
    SIGNATURE_REASON.CERT_EMITTER_MISMATCH,
  ].includes(certCheck.reasonCode);

  return {
    status: isInvalid ? SIGNATURE_STATUS.INVALID : SIGNATURE_STATUS.UNVERIFIED,
    reasonCode: certCheck.reasonCode,
    reason: certCheck.reason,
    certificateValidation: certCheck.certificateValidation ?? null,
  };
};

/**
 * @param {string} xmlText
 * @param {{ infNfeId?: string, emitenteCnpj?: string|null, emitenteCpf?: string|null, dhRecbto?: string|null, dhEmi?: string|null, authorizationStatus?: string|null }} [context]
 */
export const verifyPurchaseNfeXmlSignature = (xmlText, context = {}) => {
  const text = String(xmlText || '');
  const doc = parseXmlDocument(text);
  const block = extractSignatureBlock(doc);

  if (!block) {
    return {
      status: SIGNATURE_STATUS.UNVERIFIED,
      reasonCode: SIGNATURE_REASON.SIGNATURE_ABSENT,
      reason: 'Elemento Signature ausente — autenticidade não confirmada',
    };
  }

  const expectedRef = `#${String(context.infNfeId || '').trim()}`;
  if (context.infNfeId && block.referenceUri && block.referenceUri !== expectedRef) {
    return {
      status: SIGNATURE_STATUS.UNVERIFIED,
      reasonCode: SIGNATURE_REASON.REFERENCE_URI_MISMATCH,
      reason: `Reference URI ${block.referenceUri} difere de ${expectedRef}`,
    };
  }

  const algoCheck = validateSignatureAlgorithms(block);
  if (!algoCheck.ok) {
    return {
      status: SIGNATURE_STATUS.UNVERIFIED,
      reasonCode: algoCheck.reasonCode,
      reason: algoCheck.reason,
    };
  }

  let cryptoCompleted = false;
  let cryptoValid = false;
  let validationErrors = [];

  try {
    const sig = new SignedXml();
    if (block.element) {
      sig.loadSignature(block.element);
    }
    cryptoValid = sig.checkSignature(text);
    cryptoCompleted = true;
    validationErrors = sig.validationErrors || [];
  } catch (err) {
    return {
      status: SIGNATURE_STATUS.UNVERIFIED,
      reasonCode: SIGNATURE_REASON.VERIFICATION_ERROR,
      reason: err instanceof Error ? err.message : String(err),
      details: { phase: 'checkSignature' },
    };
  }

  if (cryptoCompleted && !cryptoValid) {
    return {
      status: SIGNATURE_STATUS.INVALID,
      reasonCode: SIGNATURE_REASON.CRYPTO_INVALID,
      reason: 'Verificação criptográfica concluída — assinatura incorreta',
      validationErrors,
    };
  }

  const certCheck = validateCertificateTemporalAndEmitter(block.x509Certificate, context);
  if (!certCheck.ok) {
    return buildCertFailureResult(certCheck);
  }

  const trust = verifyIcpBrasilTrustChain(certCheck.pem);
  if (!trust.ok) {
    return {
      status: SIGNATURE_STATUS.UNVERIFIED,
      reasonCode: SIGNATURE_REASON.CRYPTO_VALID_TRUST_UNVERIFIED,
      reason: trust.reason,
      details: { cryptoValid: true },
      certificateValidation: certCheck.certificateValidation ?? null,
    };
  }

  return {
    status: SIGNATURE_STATUS.VALID,
    reasonCode: null,
    reason: null,
    certificateValidation: certCheck.certificateValidation ?? null,
  };
};

/** Para testes — Signature presente mas verificação não concluível. */
export const markSignatureVerificationErrorForTests = (xmlText) => (
  String(xmlText).replace(
    '</infNFe>',
    `</infNFe><Signature xmlns="${DSIG_NS}"><Broken/></Signature>`,
  )
);

/** Para testes — estrutura mínima com SignatureValue inválido (crypto concluída). */
export const markSignatureInvalidForTests = (xmlText, infNfeId) => {
  const id = infNfeId || String(xmlText).match(/Id="([^"]+)"/)?.[1] || 'NFe000';
  const refId = id.replace(/^#/, '');
  return String(xmlText).replace(
    '</infNFe>',
    `</infNFe><Signature xmlns="${DSIG_NS}">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <Reference URI="#${refId}">
          <Transforms>
            <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
          </Transforms>
          <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <DigestValue>dGVzdA==</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>INVALIDBASE64SIG==</SignatureValue>
    </Signature>`,
  );
};
