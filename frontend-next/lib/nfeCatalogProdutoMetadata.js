/**
 * Metadados NF-e / NFC-e no catálogo de produtos (`metadata_json`).
 */

import { DEFAULT_NFE_CSOSN, DEFAULT_NFE_PIS_COFINS_CST, onlyDigits } from '@/lib/fiscalEmit';

export function emptyNfeCatalogProdutoFormFields() {
  return {
    ncm: '',
    cfop: '5102',
    unidade: 'UN',
    icmsCsosn: DEFAULT_NFE_CSOSN,
    pisCst: DEFAULT_NFE_PIS_COFINS_CST,
    cofinsCst: DEFAULT_NFE_PIS_COFINS_CST,
    cest: '',
  };
}

export function readNfeCatalogProdutoMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw;
  const str = (key) => (typeof o[key] === 'string' ? o[key] : undefined);
  return {
    ncm: str('ncm'),
    cfop: str('cfop'),
    unidade: str('unidade'),
    icmsCsosn: str('icmsCsosn') ?? str('icms_csosn'),
    pisCst: str('pisCst') ?? str('pis_cst'),
    cofinsCst: str('cofinsCst') ?? str('cofins_cst'),
    cest: str('cest'),
  };
}

export function nfeCatalogProdutoFormFieldsFromMetadata(metadataJson) {
  const meta = readNfeCatalogProdutoMetadata(metadataJson);
  const defaults = emptyNfeCatalogProdutoFormFields();
  return {
    ncm: onlyDigits(meta.ncm ?? '', 8),
    cfop: onlyDigits(meta.cfop ?? defaults.cfop, 4) || defaults.cfop,
    unidade: (meta.unidade ?? defaults.unidade).trim() || defaults.unidade,
    icmsCsosn: onlyDigits(meta.icmsCsosn ?? defaults.icmsCsosn, 3) || defaults.icmsCsosn,
    pisCst: onlyDigits(meta.pisCst ?? defaults.pisCst, 2) || defaults.pisCst,
    cofinsCst: onlyDigits(meta.cofinsCst ?? defaults.cofinsCst, 2) || defaults.cofinsCst,
    cest: onlyDigits(meta.cest ?? '', 7),
  };
}

export function resolveCatalogProdutoNcm(produto) {
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto?.metadata_json);
  const fromMeta = onlyDigits(fields.ncm, 8);
  if (fromMeta.length === 8) return fromMeta;
  const fromLegacy = onlyDigits(String(produto?.ncm ?? produto?.cnae ?? ''), 8);
  return fromLegacy.length === 8 ? fromLegacy : '';
}

export function isCatalogProdutoUsableForNfeLike(produto, documentType) {
  if (documentType === 'NFSE') return true;
  const ncm = resolveCatalogProdutoNcm(produto);
  return ncm.length === 8;
}
