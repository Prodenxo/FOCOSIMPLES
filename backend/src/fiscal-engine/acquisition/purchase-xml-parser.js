/**
 * Parser XML NF-e de compra — extrai dados, não decide tributação de saída.
 */
import {
  assertSecurePurchaseXmlInput,
  parseSecurePurchaseXmlDocument,
} from './purchase-xml-security.js';
import {
  onlyDigits,
  sha256Hex,
  validateChaveNFe,
  validateInfNFeIdMatchesChave,
} from './purchase-xml-validator.js';
import {
  buildDetXmlPath,
  decimalFieldOf,
  parseOrigemFromXml,
  textOf,
} from './purchase-xml-parse-utils.js';
import {
  buildPurchaseItemTaxParse,
  extractIcmsGroupsFromDet,
} from './purchase-item-tax-parse.js';
import { buildUnitConversionEvidence } from './unit-conversion.js';
import { PURCHASE_DOCUMENT_STATUS, PURCHASE_XML_PARSER_VERSION, AUTHORIZATION_STATUS, EVENT_STATUS } from './constants.js';
import { verifyPurchaseNfeXmlSignature } from './purchase-xml-signature.js';
import { validateProtocolDigestCoherence } from './purchase-protocol-digest.js';
import { validateChaveCoherenceWithXml } from './purchase-chave-coherence.js';

/**
 * @param {string} cStat
 */
export const mapProtocolCStatToAuthorizationStatus = (cStat) => {
  const code = onlyDigits(cStat, 3);
  if (code === '100') return AUTHORIZATION_STATUS.AUTHORIZED;
  if (code === '110' || code === '301' || code === '302') return AUTHORIZATION_STATUS.NOT_AUTHORIZED;
  return AUTHORIZATION_STATUS.UNKNOWN;
};

/**
 * @param {string} cStat
 */
export const mapProtocolCStatToEventStatus = (cStat) => {
  const code = onlyDigits(cStat, 3);
  if (code === '101' || code === '135' || code === '155') return 'CANCELED';
  if (code === '100') return 'NOT_CHECKED';
  return 'UNKNOWN';
};

/** @deprecated use mapProtocolCStatToAuthorizationStatus */
export const mapProtocolCStatToDocumentStatus = (cStat) => {
  const auth = mapProtocolCStatToAuthorizationStatus(cStat);
  if (auth === AUTHORIZATION_STATUS.AUTHORIZED) return PURCHASE_DOCUMENT_STATUS.AUTHORIZED;
  if (auth === AUTHORIZATION_STATUS.NOT_AUTHORIZED) return PURCHASE_DOCUMENT_STATUS.DENIED;
  const code = onlyDigits(cStat, 3);
  if (code === '101' || code === '135' || code === '155') return PURCHASE_DOCUMENT_STATUS.CANCELED;
  return PURCHASE_DOCUMENT_STATUS.UNKNOWN;
};

/**
 * @param {Buffer|string} xmlInput
 * @param {{ maxBytes?: number }} [options]
 */
export const parsePurchaseNfeXml = (xmlInput, options = {}) => {
  const xmlText = assertSecurePurchaseXmlInput(xmlInput, options);
  const xmlSha256 = sha256Hex(xmlText);
  const doc = parseSecurePurchaseXmlDocument(xmlText);
  const warnings = [];

  const infNFeList = doc.getElementsByTagName('infNFe');
  if (!infNFeList?.length) throw new Error('infNFe não encontrado');
  const infNFe = infNFeList.item(0);
  if (!infNFe) throw new Error('infNFe inválido');

  const infNfeId = infNFe.getAttribute('Id') || infNFe.getAttribute('id');
  const ide = infNFe.getElementsByTagName('ide').item(0);
  const emit = infNFe.getElementsByTagName('emit').item(0);
  const dest = infNFe.getElementsByTagName('dest').item(0);

  const chaveFromIde = onlyDigits(textOf(infNFe, 'chNFe') || textOf(ide, 'cNF'), 44);
  let chave = infNfeId ? onlyDigits(String(infNfeId).replace(/^NFe/i, ''), 44) : chaveFromIde;

  const chaveCheck = validateChaveNFe(chave);
  if (!chaveCheck.ok) throw new Error(chaveCheck.reason);
  chave = chaveCheck.chave;

  if (infNfeId) {
    const idCheck = validateInfNFeIdMatchesChave(infNfeId, chave);
    if (!idCheck.ok) warnings.push(idCheck.reason);
  }

  const protNFe = doc.getElementsByTagName('protNFe').item(0);
  const infProt = protNFe?.getElementsByTagName('infProt').item(0) ?? doc.getElementsByTagName('infProt').item(0);
  const protocoloCstat = textOf(infProt, 'cStat');
  const protocoloNumero = textOf(infProt, 'nProt');
  const protocoloChave = onlyDigits(textOf(infProt, 'chNFe'), 44);

  if (protocoloChave && protocoloChave !== chave) {
    warnings.push('chNFe do protocolo difere da chave infNFe');
  }

  const documentStatus = protocoloCstat
    ? mapProtocolCStatToDocumentStatus(protocoloCstat)
    : PURCHASE_DOCUMENT_STATUS.UNKNOWN;

  const authorizationStatus = protocoloCstat
    ? mapProtocolCStatToAuthorizationStatus(protocoloCstat)
    : AUTHORIZATION_STATUS.UNKNOWN;

  const eventStatus = protocoloCstat
    ? mapProtocolCStatToEventStatus(protocoloCstat)
    : 'NOT_CHECKED';

  if (!protocoloCstat) {
    warnings.push('Protocolo de autorização ausente — authorizationStatus UNKNOWN, eventStatus NOT_CHECKED');
  }

  const cUF = textOf(ide, 'cUF');
  const tpEmis = textOf(ide, 'tpEmis') || '1';
  const cNF = textOf(ide, 'cNF');

  const dhEmi = textOf(ide, 'dhEmi') || textOf(ide, 'dEmi');
  const effectiveDate = dhEmi ? String(dhEmi).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const emitenteCnpj = textOf(emit, 'CNPJ') ? onlyDigits(textOf(emit, 'CNPJ'), 14) : null;
  const emitenteCpf = textOf(emit, 'CPF') ? onlyDigits(textOf(emit, 'CPF'), 11) : null;
  const destinatarioDoc = onlyDigits(textOf(dest, 'CNPJ') || textOf(dest, 'CPF'), 14);
  const resolvedInfNfeId = infNfeId || `NFe${chave}`;
  const dhRecbto = textOf(infProt, 'dhRecbto');

  const signatureResult = verifyPurchaseNfeXmlSignature(xmlText, {
    infNfeId: resolvedInfNfeId,
    emitenteCnpj,
    emitenteCpf,
    dhRecbto,
    dhEmi,
    authorizationStatus,
  });

  const protocolDigVal = textOf(infProt, 'digVal');
  const protocolDigestCheck = validateProtocolDigestCoherence({
    xmlText,
    infNfeId: resolvedInfNfeId,
    protocolDigVal,
  });
  if (!protocolDigestCheck.ok) {
    warnings.push(protocolDigestCheck.reason);
  }

  const header = {
    chaveNfe: chave,
    infNfeId: resolvedInfNfeId,
    cUF,
    tpEmis,
    cNF,
    modelo: Number(textOf(ide, 'mod') || '55'),
    serie: textOf(ide, 'serie'),
    numero: textOf(ide, 'nNF'),
    dhEmi,
    emitenteCnpj,
    destinatarioDoc,
    documentStatus,
    authorizationStatus,
    eventStatus,
    signatureStatus: signatureResult.status,
    signatureReason: signatureResult.reason,
    signatureReasonCode: signatureResult.reasonCode,
    certificateValidation: signatureResult.certificateValidation ?? null,
    protocolDigestOk: protocolDigestCheck.ok !== false,
    protocolDigestSkipped: protocolDigestCheck.skipped === true,
    protocolo: {
      cStat: protocoloCstat,
      nProt: protocoloNumero,
      chNFe: protocoloChave || chave,
      digVal: protocolDigVal,
      dhRecbto,
    },
    xmlSha256,
    parserVersion: PURCHASE_XML_PARSER_VERSION,
    parseWarnings: warnings,
  };

  const chaveCoherence = validateChaveCoherenceWithXml(header, infNfeId);
  if (!chaveCoherence.ok) {
    for (const msg of chaveCoherence.issues) warnings.push(msg);
    header.chaveCoherenceOk = false;
  } else {
    header.chaveCoherenceOk = true;
    header.chaveNfe = chaveCoherence.chave;
  }

  const detList = infNFe.getElementsByTagName('det');
  /** @type {object[]} */
  const items = [];

  for (let i = 0; i < detList.length; i += 1) {
    const det = detList.item(i);
    if (!det) continue;
    const detPath = buildDetXmlPath(det);
    const prod = det.getElementsByTagName('prod').item(0);
    if (!prod) continue;

    const nItem = Number(textOf(det, 'nItem') || String(i + 1));
    const icmsGroups = extractIcmsGroupsFromDet(det, detPath, effectiveDate);
    const origem = parseOrigemFromXml(
      icmsGroups[0]?.orig ?? textOf(prod, 'orig'),
    );

    const itemCommercial = {
      cProd: textOf(prod, 'cProd'),
      cEAN: textOf(prod, 'cEAN') || textOf(prod, 'cEANTrib'),
      xProd: textOf(prod, 'xProd'),
      ncm: onlyDigits(textOf(prod, 'NCM'), 8),
      supplierCest: onlyDigits(textOf(prod, 'CEST'), 7) || null,
      cfop: onlyDigits(textOf(prod, 'CFOP'), 4),
      origem,
      uCom: textOf(prod, 'uCom') || 'UN',
      qCom: decimalFieldOf(prod, 'qCom', 'qCom', effectiveDate) || '0',
      vUnCom: decimalFieldOf(prod, 'vUnCom', 'vUnCom', effectiveDate) || '0',
      vProd: decimalFieldOf(prod, 'vProd', 'vProd', effectiveDate) || '0',
      cEANTrib: textOf(prod, 'cEANTrib'),
      uTrib: textOf(prod, 'uTrib') || textOf(prod, 'uCom') || 'UN',
      qTrib: decimalFieldOf(prod, 'qTrib', 'qCom', effectiveDate) || decimalFieldOf(prod, 'qCom', 'qCom', effectiveDate) || '0',
      vUnTrib: decimalFieldOf(prod, 'vUnTrib', 'vUnCom', effectiveDate) || decimalFieldOf(prod, 'vUnCom', 'vUnCom', effectiveDate) || '0',
      indTot: textOf(prod, 'indTot'),
      desconto: decimalFieldOf(prod, 'vDesc', 'vProd', effectiveDate),
      frete: null,
      seguro: null,
      outrasDespesas: null,
    };

    const unitConversion = buildUnitConversionEvidence(itemCommercial);

    const parsedTax = buildPurchaseItemTaxParse({
      itemIndex: nItem,
      ncm: itemCommercial.ncm,
      cest: itemCommercial.supplierCest,
      origem,
      cfop: itemCommercial.cfop,
      icmsGroups,
      rawPaths: [detPath, ...icmsGroups.map((g) => g.rawXmlPath)],
      parserVersion: PURCHASE_XML_PARSER_VERSION,
      parseWarnings: unitConversion.warnings,
    });

    items.push({
      numeroItem: nItem,
      commercial: itemCommercial,
      parsedTax,
      unitConversion,
    });
  }

  return { header, items, xmlSha256, xmlText };
};
