/**
 * Metadados NFS-e (Reforma Tributária) gravados em `metadata_json` do catálogo de serviços.
 */

/** LC 116 (6 dígitos) → NBS (9 dígitos) — subset alinhado ao backend. */
const LC116_NBS_SUGGESTIONS = {
  140101: '120013110',
  '060301': '126023000',
  170601: '114061100',
};

export const NFSE_CINDOP_FIELD_HINT =
  'Código de 6 dígitos da LC 214 (Anexo VII), conforme o tipo de serviço e onde ele é prestado. '
  + 'Consulte seu contador ou a prefeitura se tiver dúvida.';

export const NFSE_CODIGO_TRIBUTACAO_FIELD_HINT =
  'Código do serviço no cadastro da prefeitura (cTribMun). Em Ribeirão Preto tem 5 dígitos (ex.: 71602); '
  + 'em outras cidades costuma ser 001. Peça ao contador o código habilitado para a empresa.';

export function emptyNfseCatalogProdutoFormFields() {
  return { codigoNbs: '', cIndOp: '', codigoTributacao: '' };
}

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

export function normalizeCodigoNbsInput(value) {
  return onlyDigits(value, 9);
}

export function normalizeCIndOpInput(value) {
  return onlyDigits(value, 6);
}

export function normalizeCodigoTributacaoInput(value) {
  return onlyDigits(value, 10);
}

export function readNfseCatalogProdutoMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw;
  const str = (key) => (typeof o[key] === 'string' ? o[key] : undefined);
  return {
    codigoNbs: str('codigoNbs') ?? str('codigo_nbs'),
    cIndOp: str('cIndOp') ?? str('codigoOperacao'),
    codigoOperacao: str('codigoOperacao') ?? str('cIndOp'),
    codigoTributacao: str('codigoTributacao') ?? str('codigo_tributacao') ?? str('cTribMun'),
  };
}

export function nfseCatalogProdutoFormFieldsFromMetadata(metadataJson) {
  const meta = readNfseCatalogProdutoMetadata(metadataJson);
  return {
    codigoNbs: normalizeCodigoNbsInput(meta.codigoNbs ?? ''),
    cIndOp: normalizeCIndOpInput(meta.cIndOp ?? meta.codigoOperacao ?? ''),
    codigoTributacao: normalizeCodigoTributacaoInput(meta.codigoTributacao ?? ''),
  };
}

export function lookupSuggestedCodigoNbs(codigoLc116) {
  const key = String(codigoLc116 || '').replace(/[^0-9A-Za-z]/g, '');
  if (!key) return null;
  const padded = key.length >= 6 ? key.slice(0, 6) : key.padStart(6, '0');
  const nbs = LC116_NBS_SUGGESTIONS[padded] ?? LC116_NBS_SUGGESTIONS[key];
  if (!nbs || nbs.length !== 9) return null;
  return nbs;
}

export function validateNfseCatalogProdutoFormFields(fields) {
  const cIndOp = normalizeCIndOpInput(fields.cIndOp);
  if (fields.cIndOp.trim() && cIndOp.length !== 6) {
    return 'Indicador de operação (cIndOp) deve ter 6 dígitos.';
  }
  const codigoTributacao = normalizeCodigoTributacaoInput(fields.codigoTributacao);
  if (fields.codigoTributacao?.trim() && codigoTributacao.length < 3) {
    return 'Código do serviço na prefeitura deve ter ao menos 3 dígitos.';
  }
  return null;
}

export function buildNfseCatalogProdutoMetadata(existingMetadata, fields) {
  const base = existingMetadata && typeof existingMetadata === 'object' ? { ...existingMetadata } : {};
  const nbs = normalizeCodigoNbsInput(fields.codigoNbs);
  const cIndOp = normalizeCIndOpInput(fields.cIndOp);
  const codigoTributacao = normalizeCodigoTributacaoInput(fields.codigoTributacao);

  const next = { ...base };
  if (nbs.length === 9) {
    next.codigoNbs = nbs;
    next.codigo_nbs = nbs;
  } else {
    delete next.codigoNbs;
    delete next.codigo_nbs;
  }
  if (cIndOp.length === 6) {
    next.cIndOp = cIndOp;
    next.codigoOperacao = cIndOp;
  } else {
    delete next.cIndOp;
    delete next.codigoOperacao;
  }
  if (codigoTributacao.length >= 3) {
    next.codigoTributacao = codigoTributacao;
    next.codigo_tributacao = codigoTributacao;
  } else {
    delete next.codigoTributacao;
    delete next.codigo_tributacao;
  }
  return next;
}

export function catalogProdutoNeedsNfseReformaCompletion(produto) {
  if (produto.document_type && produto.document_type !== 'NFSE') return false;
  const fields = nfseCatalogProdutoFormFieldsFromMetadata(produto.metadata_json);
  return !fields.cIndOp;
}

export function applyCatalogProdutoToNfseServico(produto) {
  const reforma = nfseCatalogProdutoFormFieldsFromMetadata(produto?.metadata_json);
  return {
    codigo: String(produto?.codigo ?? '').trim(),
    cnae: produto?.cnae ?? '',
    discriminacao: produto?.discriminacao ?? '',
    aliquota: produto?.aliquota != null ? String(produto.aliquota) : '',
    valorServico: produto?.valor_sugerido != null ? String(produto.valor_sugerido) : '',
    ...(reforma.codigoNbs ? { codigoNbs: reforma.codigoNbs } : {}),
    ...(reforma.cIndOp ? { cIndOp: reforma.cIndOp } : {}),
    ...(reforma.codigoTributacao ? { codigoTributacao: reforma.codigoTributacao } : {}),
  };
}
