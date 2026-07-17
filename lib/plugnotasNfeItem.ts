/** Mapeia item do formulário para o JSON esperado pela Plugnotas (NF-e / NFC-e). */

import type { NfeIcmsInput, NfeItemInput, NfeTributosInput } from '../services/meiNotasService';

export type PlugnotasNfeItemFormLike = {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
  cest: string;
  sku: string;
};

export type PlugnotasIcmsFormLike = {
  origem?: string;
  cst?: string;
  csosn?: string;
};

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export function parseDecimalInput(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalDecimal(value: string): number | undefined {
  const parsed = parseDecimalInput(value);
  return parsed === null ? undefined : parsed;
}

/** CPF ou destinatário não contribuinte → consumidor final (exigência SEFAZ com indIEDest=9). */
export function resolveNfeConsumidorFinal(
  destDoc: string,
  indIEDest?: string,
  inscricaoEstadual?: string,
): boolean {
  const doc = normalizeDoc(destDoc);
  const ie = normalizeDoc(inscricaoEstadual || '');
  const ind = String(indIEDest ?? '').trim();
  if (ind === '9') return true;
  if (doc.length === 14 && ind !== '1' && !ie) return true;
  if (doc.length === 11) return true;
  return false;
}

/**
 * Plugnotas exige `tributos.icms.cst`. Para MEI/SN o CSOSN (ex.: 102) vai nesse campo.
 * @see https://atendimento.tecnospeed.com.br/hc/pt-br/articles/4407667461655
 */
export function mapIcmsForPlugnotas(icms: PlugnotasIcmsFormLike = {}): NfeIcmsInput {
  const origem = String(icms.origem ?? '0').trim() || '0';
  const csosn = normalizeDoc(String(icms.csosn ?? '')).slice(0, 3);
  const cst = normalizeDoc(String(icms.cst ?? '')).slice(0, 3);
  if (csosn) {
    return { origem, cst: csosn };
  }
  if (cst) {
    return { origem, cst };
  }
  return { origem };
}

export function mapNfeItemForPlugnotas(
  item: PlugnotasNfeItemFormLike,
  tributos: NfeTributosInput | undefined,
): NfeItemInput {
  const unidade = item.unidade.trim() || 'UN';
  const quantidade = parseDecimalInput(item.quantidade);
  const valorUnitarioNum = parseDecimalInput(item.valorUnitario);
  if (quantidade === null || quantidade <= 0 || valorUnitarioNum === null || valorUnitarioNum <= 0) {
    throw new Error('Item NF-e: quantidade e valor unitário devem ser maiores que zero');
  }
  const valorTotal = quantidade * valorUnitarioNum;

  return {
    codigo: item.codigo.trim(),
    descricao: item.descricao.trim(),
    ncm: normalizeDoc(item.ncm).slice(0, 8),
    cfop: normalizeDoc(item.cfop).slice(0, 4),
    unidadeComercial: unidade,
    quantidade: { comercial: quantidade, tributavel: quantidade },
    valorUnitario: { comercial: valorUnitarioNum, tributavel: valorUnitarioNum },
    valor: valorTotal,
    ...(toOptionalDecimal(item.desconto) !== undefined ? { desconto: toOptionalDecimal(item.desconto) } : {}),
    ...(item.cest.trim() ? { cest: item.cest.trim() } : {}),
    ...(item.sku.trim() ? { sku: item.sku.trim() } : {}),
    tributos,
  };
}

/** tPag 99 exige `descricaoMeio` na Plugnotas. */
export function buildDefaultNfePagamentos(valor: number) {
  return [{
    meio: '99',
    valor,
    descricaoMeio: 'Outros',
  }];
}
