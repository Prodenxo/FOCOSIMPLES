import type { CnpjLookupData, NfseTomadorEnderecoLookup } from '../services/meiNotasService';
import type { NfseCatalogCliente } from '../services/meiNotasService';
import {
  DEFAULT_DESTINATARIO_IND_IE_DEST,
  normalizeDestinatarioIndIeDest,
  type DestinatarioIndIeDest,
} from './meiNfeDestinatarioIe';
import {
  getDefaultNfeDestinatarioEndereco,
  getDestinatarioEnderecoValidationMessage,
  type NfeDestinatarioEnderecoForm,
} from './meiNfeDestinatarioEndereco';

export interface MeiCatalogClienteFiscalMeta {
  indIEDest?: DestinatarioIndIeDest | string;
  endereco?: Partial<NfeDestinatarioEnderecoForm>;
}

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export function enderecoFromCnpjLookup(data: CnpjLookupData): NfeDestinatarioEnderecoForm {
  const e = data.endereco;
  return {
    cep: normalizeDoc(String(e?.cep ?? '')).slice(0, 8),
    logradouro: String(e?.logradouro ?? '').trim(),
    numero: String(e?.numero ?? '').trim() || 'S/N',
    complemento: String(e?.complemento ?? '').trim(),
    bairro: String(e?.bairro ?? '').trim(),
    codigoCidade: normalizeDoc(String(e?.codigoCidade ?? '')).slice(0, 7),
    descricaoCidade: String(e?.descricaoCidade ?? '').trim(),
    estado: String(e?.estado ?? '').trim().toUpperCase().slice(0, 2),
  };
}

export function mergeEnderecoFromCepLookup(
  current: NfeDestinatarioEnderecoForm,
  lookup: NfseTomadorEnderecoLookup | null | undefined,
): NfeDestinatarioEnderecoForm {
  if (!lookup) return current;
  return {
    cep: lookup.cep ? normalizeDoc(lookup.cep).slice(0, 8) : current.cep,
    logradouro: lookup.logradouro?.trim() ? lookup.logradouro.trim() : current.logradouro,
    numero: current.numero,
    complemento: lookup.complemento?.trim() ? lookup.complemento.trim() : current.complemento,
    bairro: lookup.bairro?.trim() ? lookup.bairro.trim() : current.bairro,
    codigoCidade: lookup.codigoCidade
      ? normalizeDoc(String(lookup.codigoCidade)).slice(0, 7)
      : current.codigoCidade,
    descricaoCidade: lookup.descricaoCidade?.trim()
      ? lookup.descricaoCidade.trim()
      : current.descricaoCidade,
    estado: lookup.estado?.trim()
      ? lookup.estado.trim().toUpperCase().slice(0, 2)
      : current.estado,
  };
}

export function isTomadorEnderecoComplete(
  endereco?: Partial<NfeDestinatarioEnderecoForm> | null,
): boolean {
  const merged = {
    ...getDefaultNfeDestinatarioEndereco(),
    ...(endereco || {}),
  };
  return getDestinatarioEnderecoValidationMessage(merged, 'NFS-e (tomador)') === null;
}

/**
 * Busca tomador NFS-e no catálogo ou na Receita quando o endereço ainda não foi preenchido.
 */
export async function resolveNfseTomadorByCnpj(
  cnpjMasked: string,
  catalogClientes: NfseCatalogCliente[],
  lookupCnpjFn: (digits: string) => Promise<CnpjLookupData>,
): Promise<{
  tomadorRazaoSocial: string;
  tomadorEmail: string;
  tomadorEndereco: NfeDestinatarioEnderecoForm;
} | null> {
  const digits = normalizeDoc(cnpjMasked);
  if (digits.length !== 14) return null;

  const fromCatalog = catalogClientes.find(
    (item) => normalizeDoc(item.documento || '') === digits,
  );
  if (fromCatalog && catalogClienteHasTomadorEndereco(fromCatalog)) {
    return applyCatalogClienteToNfseForm(fromCatalog);
  }

  const catalogPrefill = fromCatalog ? applyCatalogClienteToNfseForm(fromCatalog) : null;

  try {
    const data = await lookupCnpjFn(digits);
    return {
      tomadorRazaoSocial:
        catalogPrefill?.tomadorRazaoSocial || String(data.razaoSocial ?? '').trim(),
      tomadorEmail: catalogPrefill?.tomadorEmail || String(data.email ?? '').trim(),
      tomadorEndereco: enderecoFromCnpjLookup(data),
    };
  } catch {
    return catalogPrefill;
  }
}

export function parseCatalogClienteFiscalMeta(
  metadata: Record<string, unknown> | null | undefined,
): MeiCatalogClienteFiscalMeta {
  if (!metadata || typeof metadata !== 'object') return {};
  const rawEndereco =
    metadata.endereco && typeof metadata.endereco === 'object'
      ? (metadata.endereco as Record<string, unknown>)
      : {};
  const base = getDefaultNfeDestinatarioEndereco();
  return {
    ...(metadata.indIEDest != null
      ? { indIEDest: normalizeDestinatarioIndIeDest(metadata.indIEDest) }
      : {}),
    endereco: {
      cep: normalizeDoc(String(rawEndereco.cep ?? '')).slice(0, 8),
      logradouro: String(rawEndereco.logradouro ?? base.logradouro).trim(),
      numero: String(rawEndereco.numero ?? base.numero).trim(),
      complemento: String(rawEndereco.complemento ?? base.complemento).trim(),
      bairro: String(rawEndereco.bairro ?? base.bairro).trim(),
      codigoCidade: normalizeDoc(String(rawEndereco.codigoCidade ?? '')).slice(0, 7),
      descricaoCidade: String(rawEndereco.descricaoCidade ?? base.descricaoCidade).trim(),
      estado: String(rawEndereco.estado ?? base.estado)
        .trim()
        .toUpperCase()
        .slice(0, 2),
    },
  };
}

export function buildCatalogClienteMetadataJson(input: {
  indIEDest?: DestinatarioIndIeDest;
  endereco?: NfeDestinatarioEnderecoForm;
}): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (input.indIEDest) meta.indIEDest = input.indIEDest;
  const e = input.endereco;
  if (e) {
    const endereco = {
      ...(normalizeDoc(e.cep) ? { cep: normalizeDoc(e.cep).slice(0, 8) } : {}),
      ...(e.logradouro.trim() ? { logradouro: e.logradouro.trim() } : {}),
      ...(e.numero.trim() ? { numero: e.numero.trim() } : {}),
      ...(e.complemento.trim() ? { complemento: e.complemento.trim() } : {}),
      ...(e.bairro.trim() ? { bairro: e.bairro.trim() } : {}),
      ...(normalizeDoc(e.codigoCidade) ? { codigoCidade: normalizeDoc(e.codigoCidade).slice(0, 7) } : {}),
      ...(e.descricaoCidade.trim() ? { descricaoCidade: e.descricaoCidade.trim() } : {}),
      ...(e.estado.trim() ? { estado: e.estado.trim().toUpperCase().slice(0, 2) } : {}),
    };
    if (Object.keys(endereco).length) meta.endereco = endereco;
  }
  return Object.keys(meta).length ? meta : undefined;
}

export function catalogClienteHasNfeEndereco(item: NfseCatalogCliente): boolean {
  const meta = parseCatalogClienteFiscalMeta(item.metadata_json ?? undefined);
  const e = meta.endereco ?? getDefaultNfeDestinatarioEndereco();
  return (
    normalizeDoc(e.cep).length === 8 &&
    Boolean(e.logradouro.trim()) &&
    Boolean(e.numero.trim()) &&
    Boolean(e.bairro.trim()) &&
    normalizeDoc(e.codigoCidade).length === 7 &&
    Boolean(e.descricaoCidade.trim()) &&
    e.estado.trim().length === 2
  );
}

export function applyCatalogClienteToNfeForm(
  item: NfseCatalogCliente,
): {
  destinatarioCpfCnpj: string;
  destinatarioRazaoSocial: string;
  destinatarioEmail: string;
  destinatarioIndIEDest: DestinatarioIndIeDest;
  destinatarioEndereco: NfeDestinatarioEnderecoForm;
} {
  const meta = parseCatalogClienteFiscalMeta(item.metadata_json ?? undefined);
  const docDigits = normalizeDoc(item.documento ?? '');
  return {
    destinatarioCpfCnpj: docDigits,
    destinatarioRazaoSocial: String(item.nome ?? '').trim(),
    destinatarioEmail: String(item.email ?? '').trim(),
    destinatarioIndIEDest: meta.indIEDest ?? DEFAULT_DESTINATARIO_IND_IE_DEST,
    destinatarioEndereco: meta.endereco ?? getDefaultNfeDestinatarioEndereco(),
  };
}

export function applyCatalogClienteToNfseForm(
  item: NfseCatalogCliente,
): {
  tomadorCpfCnpj: string;
  tomadorRazaoSocial: string;
  tomadorEmail: string;
  tomadorEndereco: NfeDestinatarioEnderecoForm;
} {
  const meta = parseCatalogClienteFiscalMeta(item.metadata_json ?? undefined);
  const docDigits = normalizeDoc(item.documento ?? '');
  return {
    tomadorCpfCnpj: docDigits,
    tomadorRazaoSocial: String(item.nome ?? '').trim(),
    tomadorEmail: String(item.email ?? '').trim(),
    tomadorEndereco: meta.endereco ?? getDefaultNfeDestinatarioEndereco(),
  };
}

export function catalogClienteHasTomadorEndereco(item: NfseCatalogCliente): boolean {
  return catalogClienteHasNfeEndereco(item);
}

/** Endereço completo obrigatório só para tomador PJ (CNPJ) na NFS-e. CPF pode cadastrar sem endereço. */
export function validateCatalogClienteNfseTomadorFields(
  documento: string,
  endereco: NfeDestinatarioEnderecoForm,
): string | null {
  if (normalizeDoc(documento).length !== 14) return null;
  return getDestinatarioEnderecoValidationMessage(endereco, 'NFS-e (tomador)');
}

export function validateCatalogClienteNfeFields(
  documentType: string,
  endereco: NfeDestinatarioEnderecoForm,
): string | null {
  if (documentType !== 'NFE') return null;
  const cep = normalizeDoc(endereco.cep);
  if (cep.length !== 8) {
    return 'Para cliente NF-e, informe o CEP (8 dígitos). Dica: ao digitar o CNPJ, buscamos o endereço automaticamente.';
  }
  if (!endereco.logradouro.trim()) return 'Informe o logradouro do cliente NF-e.';
  if (!endereco.numero.trim()) return 'Informe o número do endereço do cliente NF-e.';
  if (!endereco.bairro.trim()) return 'Informe o bairro do cliente NF-e.';
  if (normalizeDoc(endereco.codigoCidade).length !== 7) {
    return 'Informe o código IBGE da cidade (7 dígitos).';
  }
  if (!endereco.descricaoCidade.trim()) return 'Informe a cidade do cliente NF-e.';
  if (endereco.estado.trim().length !== 2) return 'Informe a UF (2 letras).';
  return null;
}
