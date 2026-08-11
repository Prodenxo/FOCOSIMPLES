/**
 * Segurança XML — anti-XXE, limite de tamanho, rejeição malformada.
 */
import { DOMParser } from '@xmldom/xmldom';
import { DEFAULT_MAX_PURCHASE_XML_BYTES } from './constants.js';

const ENTITY_PATTERN = /<!ENTITY\b/i;
const DOCTYPE_PATTERN = /<!DOCTYPE\b/i;
const EXTERNAL_ENTITY_PATTERN = /<!ENTITY[^>]+(?:SYSTEM|PUBLIC)\b/i;

/**
 * @param {Buffer|string} input
 * @param {{ maxBytes?: number }} [options]
 */
export const assertSecurePurchaseXmlInput = (input, options = {}) => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PURCHASE_XML_BYTES;
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input ?? ''), 'utf8');
  if (buf.length === 0) {
    throw new Error('XML vazio');
  }
  if (buf.length > maxBytes) {
    throw new Error(`XML excede limite de ${maxBytes} bytes`);
  }
  const text = buf.toString('utf8');
  if (DOCTYPE_PATTERN.test(text)) {
    throw new Error('DOCTYPE não permitido em XML de compra');
  }
  if (EXTERNAL_ENTITY_PATTERN.test(text)) {
    throw new Error('Entidade externa não permitida');
  }
  if (ENTITY_PATTERN.test(text)) {
    throw new Error('Declaração ENTITY não permitida');
  }
  return text;
};

/**
 * @param {string} xmlText
 */
export const parseSecurePurchaseXmlDocument = (xmlText) => {
  const parser = new DOMParser({
    locator: {},
    errorHandler: {
      warning: () => {},
      error: (msg) => { throw new Error(`XML malformado: ${msg}`); },
      fatalError: (msg) => { throw new Error(`XML fatal: ${msg}`); },
    },
  });
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error(`XML malformado: ${parseError.textContent || 'parsererror'}`);
  }
  return doc;
};

/**
 * Detecta tentativa XXE clássica (file://, expectativa de entidade externa).
 * @param {string} xmlText
 */
export const detectXxePatterns = (xmlText) => {
  const text = String(xmlText || '');
  const patterns = [
    /<!ENTITY/i,
    /<!DOCTYPE/i,
    /SYSTEM\s+["']file:/i,
    /SYSTEM\s+["']http/i,
    /PUBLIC\s+["'][^"']+["']\s+["']file:/i,
  ];
  return patterns.some((re) => re.test(text));
};
