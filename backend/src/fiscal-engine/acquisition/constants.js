/** Versão do parser XML de compra NF-e. */
export const PURCHASE_XML_PARSER_VERSION = '1.0.0';

/** Tamanho máximo padrão do XML (5 MB). */
export const DEFAULT_MAX_PURCHASE_XML_BYTES = 5 * 1024 * 1024;

export const PURCHASE_DOCUMENT_STATUS = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  CANCELED: 'CANCELED',
  DENIED: 'DENIED',
  UNKNOWN: 'UNKNOWN',
});

/** Autorização SEFAZ no momento da importação. */
export const AUTHORIZATION_STATUS = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  UNKNOWN: 'UNKNOWN',
});

/** Eventos posteriores (cancelamento etc.) — preparado para procEventoNFe. */
export const EVENT_STATUS = Object.freeze({
  NOT_CHECKED: 'NOT_CHECKED',
  CANCELED: 'CANCELED',
  ACTIVE_AS_OF_CHECK: 'ACTIVE_AS_OF_CHECK',
  UNKNOWN: 'UNKNOWN',
});

/** Validação criptográfica da assinatura XML. */
export const SIGNATURE_STATUS = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  UNVERIFIED: 'UNVERIFIED',
});

export const CATALOG_MATCH_STATUS = Object.freeze({
  UNMATCHED: 'UNMATCHED',
  AUTO_SUGGESTED: 'AUTO_SUGGESTED',
  MANUALLY_CONFIRMED: 'MANUALLY_CONFIRMED',
});

export const STOCK_LOT_STATUS = Object.freeze({
  PENDING_CATALOG_MATCH: 'PENDING_CATALOG_MATCH',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  USABLE: 'USABLE',
  BLOCKED: 'BLOCKED',
  DEPLETED: 'DEPLETED',
});

/** Grupos ICMS extraídos — parser only, sem decisão tributária de saída. */
export const ICMS_GROUP_TAGS = Object.freeze([
  'ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90',
  'ICMSSN101', 'ICMSSN102', 'ICMSSN103', 'ICMSSN201', 'ICMSSN202', 'ICMSSN203',
  'ICMSSN300', 'ICMSSN400', 'ICMSSN500', 'ICMSSN900',
]);

export const PRIOR_ST_DOCUMENT_CLASSIFICATION = Object.freeze({
  PRIOR_RETAINED: 'PRIOR_RETAINED',
  COLLECTED_IN_PURCHASE: 'COLLECTED_IN_PURCHASE',
  NO_ST_INDICATORS: 'NO_ST_INDICATORS',
  AMBIGUOUS: 'AMBIGUOUS',
});
