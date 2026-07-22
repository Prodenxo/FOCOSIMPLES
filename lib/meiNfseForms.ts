/**
 * Tipos de formulário, validação e construção de payload para emissão de notas (NFSe, NFe, NFC-e).
 * Adaptado do site Meu-financeiro (GuidesMei.tsx).
 */

import type {
  EmitirNfseInput,
  NfeEmitenteDestinatarioInput,
  NfeLikePayloadInput,
  NfeItemInput,
  NfeTributosInput,
} from '../services/meiNotasService';
import type { NfsePrestadorPrefillDto } from './nfsePrestadorPrefillDto';
import { formatCpfCnpjInput } from './meiFormatters';
import {
  buildDestinatarioIePayload,
  DEFAULT_DESTINATARIO_IND_IE_DEST,
  getDestinatarioIeValidationMessage,
  normalizeDestinatarioIndIeDest,
  type DestinatarioIndIeDest,
} from './meiNfeDestinatarioIe';
import {
  getDefaultNfeDestinatarioEndereco,
  getDestinatarioEnderecoValidationMessage,
  mapDestinatarioEnderecoToPayload,
  type NfeDestinatarioEnderecoForm,
} from './meiNfeDestinatarioEndereco';
import {
  mapIcmsForPlugnotas,
  mapNfeItemForPlugnotas,
  resolveNfeConsumidorFinal,
  buildDefaultNfePagamentos,
} from './plugnotasNfeItem';
import { isValidCnpjDigits, isValidCpfOrCnpjDigits } from './validateCnpj';
import {
  NFSE_SERVICO_CODIGO_MIN_LENGTH,
  normalizeCodigoServicoInput,
} from './meiCatalogoProdutoForm';

export type { DestinatarioIndIeDest } from './meiNfeDestinatarioIe';
export type { NfeDestinatarioEnderecoForm } from './meiNfeDestinatarioEndereco';
export {
  DEFAULT_DESTINATARIO_IND_IE_DEST,
  DESTINATARIO_IE_OPTIONS,
  DESTINATARIO_IE_SECTION_HINT,
  humanizeFiscalEmitError,
} from './meiNfeDestinatarioIe';
export { getDefaultNfeDestinatarioEndereco } from './meiNfeDestinatarioEndereco';

export type NotaDocumentType = 'NFSE' | 'NFE' | 'NFCE';

export interface NfsePrestadorEndereco {
  logradouro: string;
  numero: string;
  codigoCidade: string;
  cep: string;
  complemento: string;
  bairro: string;
  estado: string;
  descricaoCidade: string;
}

export interface NfeItemFormTributos {
  icms: { origem: string; cst: string; csosn: string; modalidadeBaseCalculo: string; baseCalculo: string; aliquota: string; valor: string };
  ipi: { cst: string; codigoEnquadramentoLegal: string; baseCalculo: string; aliquota: string; valor: string };
  pis: { cst: string; baseCalculo: string; aliquota: string; valor: string };
  cofins: { cst: string; baseCalculo: string; aliquota: string; valor: string };
}

export interface NfeItemForm {
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
  tributos: NfeItemFormTributos;
}

export interface NfeLikeForm {
  idIntegracao: string;
  natureza: string;
  emitenteCpfCnpj: string;
  emitenteRazaoSocial: string;
  emitenteInscricaoEstadual: string;
  destinatarioCpfCnpj: string;
  destinatarioRazaoSocial: string;
  destinatarioEmail: string;
  /** SEFAZ indIEDest: 1 contribuinte, 2 isento, 9 não contribuinte */
  destinatarioIndIEDest: DestinatarioIndIeDest;
  destinatarioInscricaoEstadual: string;
  destinatarioEndereco: NfeDestinatarioEnderecoForm;
  enviarEmail: boolean;
  informacoesComplementares: string;
  itens: NfeItemForm[];
}

const normalizeDoc = (value: string) => value.replace(/\D/g, '');
const hasRequiredText = (value: unknown) => String(value || '').trim().length > 0;

export function parseDecimalInput(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Valor total da linha (qtd × unitário) — enviado implicitamente à Plugnotas. */
export function getNfeItemLineTotal(
  item: Pick<NfeItemForm, 'quantidade' | 'valorUnitario'>,
): number | null {
  const quantidade = parseDecimalInput(item.quantidade);
  const valorUnitario = parseDecimalInput(item.valorUnitario);
  if (quantidade === null || valorUnitario === null || quantidade <= 0 || valorUnitario <= 0) {
    return null;
  }
  return quantidade * valorUnitario;
}

function toOptionalDecimal(value: string): number | undefined {
  const parsed = parseDecimalInput(value);
  return parsed === null ? undefined : parsed;
}

function takePrestadorField(
  current: string | undefined,
  incoming: string | null | undefined,
  onlyFillEmpty: boolean
): string {
  const c = String(current ?? '').trim();
  const inc = incoming == null || incoming === '' ? '' : String(incoming).trim();
  if (!inc) return String(current ?? '');
  if (onlyFillEmpty && c !== '') return c;
  return inc;
}

/**
 * Indica se o BFF devolveu prefill útil (sem linha activa / dados vazios).
 */
export function isNfsePrestadorPrefillEffectivelyEmpty(p: NfsePrestadorPrefillDto): boolean {
  const cnpj = normalizeDoc(p.prestadorCpfCnpj || '');
  if (cnpj.length >= 11) return false;
  if ((p.prestadorRazaoSocial ?? '').trim()) return false;
  if ((p.prestadorEmail ?? '').trim()) return false;
  if ((p.prestadorInscricaoMunicipal ?? '').trim()) return false;
  const e = p.prestadorEndereco;
  if (e) {
    const parts = [
      e.logradouro,
      e.numero,
      e.codigoCidade,
      e.cep,
      e.complemento,
      e.bairro,
      e.estado,
      e.descricaoCidade,
    ];
    if (parts.some((x) => String(x ?? '').trim() !== '')) return false;
  }
  return true;
}

export interface MergeNfsePrestadorPrefillOptions {
  /** Se true (default), não sobrescreve campos já preenchidos pelo utilizador. */
  onlyFillEmpty?: boolean;
}

/** Prefill local desatualizado (outro CNPJ gravado no espelho). */
export function isPrestadorPrefillStaleForCert(
  certDocumento: string | null | undefined,
  prefill: NfsePrestadorPrefillDto,
): boolean {
  const cert = normalizeDoc(certDocumento || '');
  const pre = normalizeDoc(prefill.prestadorCpfCnpj || '');
  return cert.length === 14 && pre.length === 14 && cert !== pre;
}

/** Quando o CNPJ do prefill diverge do formulário, confia no certificado/empresa atual. */
function resolvePrefillCnpjMerge(
  currentMasked: string,
  prefillDigits: string,
  onlyFillEmpty: boolean,
): { nextCnpj: string; cnpjUpdated: boolean } {
  let nextCnpj = String(currentMasked ?? '');
  if (prefillDigits.length !== 14) {
    return { nextCnpj, cnpjUpdated: false };
  }
  const curDigits = normalizeDoc(nextCnpj);
  if (!onlyFillEmpty || !curDigits) {
    nextCnpj = formatCpfCnpjInput(prefillDigits);
    return { nextCnpj, cnpjUpdated: curDigits !== prefillDigits };
  }
  if (curDigits && curDigits !== prefillDigits) {
    nextCnpj = formatCpfCnpjInput(prefillDigits);
    return { nextCnpj, cnpjUpdated: true };
  }
  return { nextCnpj, cnpjUpdated: false };
}

/**
 * Merge do DTO 2.1 em `EmitirNfseInput` (só prestador). CNPJ/CEP alinhados a `normalizeDoc` / inputs NFSe.
 */
export function mergeNfsePrestadorPrefillIntoForm(
  current: EmitirNfseInput,
  prefill: NfsePrestadorPrefillDto,
  options: MergeNfsePrestadorPrefillOptions = {}
): EmitirNfseInput {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const pec = current.prestadorEndereco ?? {};
  const pen = prefill.prestadorEndereco;

  const preCnpjDigits = normalizeDoc(prefill.prestadorCpfCnpj || '');
  const { nextCnpj, cnpjUpdated } = resolvePrefillCnpjMerge(
    current.prestadorCpfCnpj ?? '',
    preCnpjDigits,
    onlyFillEmpty,
  );
  const fieldOnlyFillEmpty = onlyFillEmpty && !cnpjUpdated;

  let nextIm = current.prestadorInscricaoMunicipal;
  if (prefill.prestadorInscricaoMunicipal != null && prefill.prestadorInscricaoMunicipal !== '') {
    const cur = String(nextIm ?? '').trim();
    if (!fieldOnlyFillEmpty || cur === '') nextIm = prefill.prestadorInscricaoMunicipal.trim();
  }

  const nextRazao = takePrestadorField(
    current.prestadorRazaoSocial,
    prefill.prestadorRazaoSocial,
    fieldOnlyFillEmpty,
  );
  const nextEmail = takePrestadorField(current.prestadorEmail, prefill.prestadorEmail, fieldOnlyFillEmpty);

  const cepDigits =
    pen?.cep != null && String(pen.cep).trim() !== ''
      ? normalizeDoc(String(pen.cep)).slice(0, 8)
      : '';
  const curCep = normalizeDoc(String(pec.cep ?? '')).slice(0, 8);
  const nextCep =
    cepDigits.length === 8 && (!fieldOnlyFillEmpty || curCep.length === 0)
      ? cepDigits
      : String(pec.cep ?? '').replace(/\D/g, '').slice(0, 8);

  const nextEstadoRaw = pen?.estado != null ? String(pen.estado).trim().toUpperCase().slice(0, 2) : '';
  const curEst = String(pec.estado ?? '').trim();
  const nextEstado =
    nextEstadoRaw && (!fieldOnlyFillEmpty || curEst === '') ? nextEstadoRaw : pec.estado ?? '';

  const nextEndereco = {
    logradouro: takePrestadorField(pec.logradouro, pen?.logradouro, fieldOnlyFillEmpty),
    numero: takePrestadorField(pec.numero, pen?.numero, fieldOnlyFillEmpty),
    codigoCidade: takePrestadorField(pec.codigoCidade, pen?.codigoCidade, fieldOnlyFillEmpty),
    cep: nextCep,
    complemento: takePrestadorField(pec.complemento, pen?.complemento, fieldOnlyFillEmpty),
    bairro: takePrestadorField(pec.bairro, pen?.bairro, fieldOnlyFillEmpty),
    estado: nextEstado,
    descricaoCidade: takePrestadorField(pec.descricaoCidade, pen?.descricaoCidade, fieldOnlyFillEmpty),
  };

  return {
    ...current,
    prestadorCpfCnpj: nextCnpj,
    ...(nextIm !== undefined && nextIm !== '' ? { prestadorInscricaoMunicipal: nextIm } : {}),
    ...(nextRazao ? { prestadorRazaoSocial: nextRazao } : {}),
    ...(nextEmail ? { prestadorEmail: nextEmail } : {}),
    prestadorEndereco: nextEndereco,
  };
}

export interface MergeNfeEmitentePrefillExtras {
  inscricaoEstadual?: string | null;
}

/**
 * Merge do prefill do emitente (certificado / empresa Plugnotas) em `NfeLikeForm`.
 */
export function mergeNfeEmitentePrefillIntoForm(
  current: NfeLikeForm,
  prefill: NfsePrestadorPrefillDto,
  extras: MergeNfeEmitentePrefillExtras = {},
  options: MergeNfsePrestadorPrefillOptions = {}
): NfeLikeForm {
  const onlyFillEmpty = options.onlyFillEmpty !== false;
  const preCnpjDigits = normalizeDoc(prefill.prestadorCpfCnpj || '');
  const { nextCnpj, cnpjUpdated } = resolvePrefillCnpjMerge(
    current.emitenteCpfCnpj ?? '',
    preCnpjDigits,
    onlyFillEmpty,
  );
  const razaoOnlyFillEmpty = onlyFillEmpty && !cnpjUpdated;

  const nextRazao = takePrestadorField(
    current.emitenteRazaoSocial,
    prefill.prestadorRazaoSocial,
    razaoOnlyFillEmpty,
  );

  let nextIe = String(current.emitenteInscricaoEstadual ?? '');
  const ieRaw = extras.inscricaoEstadual != null ? String(extras.inscricaoEstadual).trim() : '';
  if (ieRaw && (!onlyFillEmpty || !nextIe.trim() || cnpjUpdated)) {
    nextIe = ieRaw;
  }

  return {
    ...current,
    emitenteCpfCnpj: nextCnpj,
    emitenteRazaoSocial: nextRazao,
    ...(nextIe ? { emitenteInscricaoEstadual: nextIe } : {}),
  };
}

export function resolvePrestadorEndereco(
  endereco: EmitirNfseInput['prestadorEndereco'],
  fallback: Partial<NfsePrestadorEndereco> = {}
): NfsePrestadorEndereco {
  return {
    logradouro: String(endereco?.logradouro || fallback.logradouro || '').trim(),
    numero: String(endereco?.numero || fallback.numero || '').trim(),
    codigoCidade: String(endereco?.codigoCidade || fallback.codigoCidade || '').trim(),
    cep: normalizeDoc(String(endereco?.cep || fallback.cep || '')).slice(0, 8),
    complemento: String(endereco?.complemento || fallback.complemento || '').trim(),
    bairro: String(endereco?.bairro || fallback.bairro || '').trim(),
    estado: String(endereco?.estado || fallback.estado || '').trim().toUpperCase(),
    descricaoCidade: String(endereco?.descricaoCidade || fallback.descricaoCidade || '').trim(),
  };
}

export function getNfseValidationMessage(
  input: EmitirNfseInput,
  fallbackPrestadorEndereco: Partial<NfsePrestadorEndereco> = {}
): string | null {
  const prestadorCpfCnpj = normalizeDoc(input.prestadorCpfCnpj || '');
  if (prestadorCpfCnpj.length !== 14) return 'Informe um CNPJ válido do prestador.';
  const prestadorEndereco = resolvePrestadorEndereco(input.prestadorEndereco, fallbackPrestadorEndereco);
  if (!prestadorEndereco.logradouro) return 'Informe o logradouro do prestador.';
  if (!prestadorEndereco.numero) return 'Informe o número do endereço do prestador.';
  if (!prestadorEndereco.codigoCidade) return 'Informe o código IBGE da cidade do prestador.';
  if (prestadorEndereco.cep.length !== 8) return 'Informe um CEP válido do prestador com 8 dígitos.';

  const tomadorCpfCnpj = normalizeDoc(input.tomadorCpfCnpj || '');
  if (!tomadorCpfCnpj) return 'Informe o CPF/CNPJ do tomador.';
  if (tomadorCpfCnpj.length !== 11 && tomadorCpfCnpj.length !== 14) return 'CPF/CNPJ do tomador inválido.';
  const tomadorRazaoSocial = String(input.tomadorRazaoSocial || '').trim();
  if (!tomadorRazaoSocial) return 'Informe a razão social do tomador.';

  if (tomadorCpfCnpj.length === 14) {
    const enderecoForm: NfeDestinatarioEnderecoForm = {
      ...getDefaultNfeDestinatarioEndereco(),
      ...(input.tomadorEndereco || {}),
    };
    const enderecoMsg = getDestinatarioEnderecoValidationMessage(enderecoForm, 'NFS-e (tomador)');
    if (enderecoMsg) return enderecoMsg;
  }

  const servico = input.servico;
  if (!servico) return 'Preencha os campos obrigatórios do serviço.';
  if (
    !hasRequiredText(servico.codigo) ||
    !hasRequiredText(servico.cnae) ||
    !hasRequiredText(servico.discriminacao) ||
    !hasRequiredText(servico.valorServico)
  ) {
    return 'Preencha os campos obrigatórios do serviço.';
  }
  const codigoNorm = normalizeCodigoServicoInput(servico.codigo);
  if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
    return (
      `Código do serviço deve ter pelo menos ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres `
      + 'após remover pontos (ex.: 17.19.01 → 171901). Códigos curtos como 17.19 não bastam.'
    );
  }
  if (hasRequiredText(servico.aliquota)) {
    const aliquota = parseDecimalInput(servico.aliquota);
    if (aliquota === null || aliquota < 0) return 'Informe uma alíquota ISS válida.';
  }
  const valorServico = parseDecimalInput(servico.valorServico);
  if (valorServico === null || valorServico <= 0) return 'Informe um valor de serviço maior que zero.';
  return null;
}

function getNfeLikeLabel(documentType: NotaDocumentType) {
  return documentType === 'NFE' ? 'NF-e' : 'NFC-e';
}

export function getNfeLikeValidationMessage(form: NfeLikeForm, documentType: NotaDocumentType): string | null {
  const label = getNfeLikeLabel(documentType);
  const emitenteCpfCnpj = normalizeDoc(form.emitenteCpfCnpj);
  if (!emitenteCpfCnpj) {
    return `CNPJ do emitente da ${label} é obrigatório.`;
  }
  if (emitenteCpfCnpj.length !== 14 || !isValidCnpjDigits(emitenteCpfCnpj)) {
    return `Informe um CNPJ válido do emitente da ${label}.`;
  }
  const destinatarioDoc = normalizeDoc(form.destinatarioCpfCnpj);
  if (!destinatarioDoc) {
    return `CPF/CNPJ do destinatário da ${label} é obrigatório.`;
  }
  if (!isValidCpfOrCnpjDigits(destinatarioDoc)) {
    return `CPF/CNPJ do destinatário da ${label} inválido.`;
  }
  if (!hasRequiredText(form.destinatarioRazaoSocial)) return `Informe a razão social do destinatário da ${label}.`;
  if (documentType === 'NFE') {
    const ieEmitente = String(form.emitenteInscricaoEstadual || '').trim()
    if (!ieEmitente) {
      return 'Informe a Inscrição Estadual do emitente (obrigatória na NF-e de mercadoria). Use ISENTO se for o caso.'
    }
  }
  const ieMsg = getDestinatarioIeValidationMessage(
    normalizeDestinatarioIndIeDest(form.destinatarioIndIEDest),
    form.destinatarioInscricaoEstadual,
    label,
  );
  if (ieMsg) return ieMsg;
  if (documentType === 'NFE') {
    const enderecoMsg = getDestinatarioEnderecoValidationMessage(form.destinatarioEndereco, label);
    if (enderecoMsg) return enderecoMsg;
  }
  if (!Array.isArray(form.itens) || form.itens.length === 0) return `Adicione ao menos um item para emitir ${label}.`;

  for (let index = 0; index < form.itens.length; index += 1) {
    const item = form.itens[index];
    const linha = index + 1;
    if (!hasRequiredText(item.codigo)) return `Item ${linha}: informe o código.`;
    if (!hasRequiredText(item.descricao)) return `Item ${linha}: informe a descrição.`;
    if (normalizeDoc(item.ncm).length !== 8) return `Item ${linha}: NCM deve conter 8 dígitos.`;
    if (normalizeDoc(item.cfop).length !== 4) return `Item ${linha}: CFOP deve ter 4 dígitos.`;
    if (!hasRequiredText(item.unidade)) return `Item ${linha}: informe a unidade comercial.`;
    const cestDigits = normalizeDoc(item.cest);
    if (cestDigits && cestDigits.length !== 7) {
      return `Item ${linha}: CEST deve ter 7 dígitos ou ficar em branco.`;
    }
    const quantidade = parseDecimalInput(item.quantidade);
    if (quantidade === null || quantidade <= 0) return `Item ${linha}: quantidade deve ser maior que zero.`;
    const valorUnitario = parseDecimalInput(item.valorUnitario);
    if (valorUnitario === null || valorUnitario <= 0) return `Item ${linha}: valor unitário deve ser maior que zero.`;
    const icmsCsosn = normalizeDoc(item.tributos.icms.csosn);
    const icmsCst = normalizeDoc(item.tributos.icms.cst);
    if (icmsCsosn) {
      if (icmsCsosn.length !== 3) {
        return `Item ${linha}: CSOSN do ICMS deve ter 3 dígitos (ex.: 102 no Simples Nacional).`;
      }
    } else if (icmsCst.length >= 2 && icmsCst.length <= 3) {
      /* CST válido */
    } else if (!icmsCst) {
      return `Item ${linha}: informe CSOSN do ICMS (3 dígitos, ex.: 102).`;
    } else {
      return `Item ${linha}: CST do ICMS deve ter 2 ou 3 dígitos.`;
    }
    const pisCst = normalizeDoc(item.tributos.pis.cst);
    if (!pisCst) return `Item ${linha}: informe CST do PIS (ex.: 49).`;
    if (pisCst.length > 2) return `Item ${linha}: CST do PIS deve ter no máximo 2 dígitos.`;
    const cofinsCst = normalizeDoc(item.tributos.cofins.cst);
    if (!cofinsCst) return `Item ${linha}: informe CST do COFINS (ex.: 49).`;
    if (cofinsCst.length > 2) return `Item ${linha}: CST do COFINS deve ter no máximo 2 dígitos.`;
  }
  return null;
}

/** CSOSN típico para venda de mercadoria no Simples Nacional (editável por item). */
export const MEI_DEFAULT_NFE_CSOSN = '102';

/** CST PIS/COFINS comum no SN sem destaque (editável por item). */
export const MEI_DEFAULT_NFE_PIS_COFINS_CST = '49';

function getDefaultNfeTributos(): NfeItemFormTributos {
  return {
    icms: {
      origem: '0',
      cst: '',
      csosn: MEI_DEFAULT_NFE_CSOSN,
      modalidadeBaseCalculo: '',
      baseCalculo: '',
      aliquota: '',
      valor: '',
    },
    ipi: { cst: '', codigoEnquadramentoLegal: '', baseCalculo: '', aliquota: '', valor: '' },
    pis: { cst: MEI_DEFAULT_NFE_PIS_COFINS_CST, baseCalculo: '', aliquota: '', valor: '' },
    cofins: { cst: MEI_DEFAULT_NFE_PIS_COFINS_CST, baseCalculo: '', aliquota: '', valor: '' },
  };
}

export function getDefaultNfeItem(): NfeItemForm {
  return {
    codigo: '',
    descricao: '',
    ncm: '',
    cfop: '5102',
    unidade: 'UN',
    quantidade: '1',
    valorUnitario: '',
    desconto: '',
    cest: '',
    sku: '',
    tributos: getDefaultNfeTributos(),
  };
}

export function getDefaultNfeLikeForm(): NfeLikeForm {
  return {
    idIntegracao: '',
    natureza: 'VENDA',
    emitenteCpfCnpj: '',
    emitenteRazaoSocial: '',
    emitenteInscricaoEstadual: '',
    destinatarioCpfCnpj: '',
    destinatarioRazaoSocial: '',
    destinatarioEmail: '',
    destinatarioIndIEDest: DEFAULT_DESTINATARIO_IND_IE_DEST,
    destinatarioInscricaoEstadual: '',
    destinatarioEndereco: getDefaultNfeDestinatarioEndereco(),
    enviarEmail: false,
    informacoesComplementares: '',
    itens: [getDefaultNfeItem()],
  };
}

function mapNfeTributos(tributos: NfeItemFormTributos): NfeTributosInput {
  return {
    icms: {
      ...mapIcmsForPlugnotas(tributos.icms),
      ...(tributos.icms.modalidadeBaseCalculo.trim() ? { modalidadeBaseCalculo: tributos.icms.modalidadeBaseCalculo.trim() } : {}),
      ...(toOptionalDecimal(tributos.icms.baseCalculo) !== undefined ? { baseCalculo: toOptionalDecimal(tributos.icms.baseCalculo) } : {}),
      ...(toOptionalDecimal(tributos.icms.aliquota) !== undefined ? { aliquota: toOptionalDecimal(tributos.icms.aliquota) } : {}),
      ...(toOptionalDecimal(tributos.icms.valor) !== undefined ? { valor: toOptionalDecimal(tributos.icms.valor) } : {}),
    },
    pis: {
      ...(normalizeDoc(tributos.pis.cst).slice(0, 2) ? { cst: normalizeDoc(tributos.pis.cst).slice(0, 2) } : {}),
      ...(toOptionalDecimal(tributos.pis.baseCalculo) !== undefined ? { baseCalculo: toOptionalDecimal(tributos.pis.baseCalculo) } : {}),
      ...(toOptionalDecimal(tributos.pis.aliquota) !== undefined ? { aliquota: toOptionalDecimal(tributos.pis.aliquota) } : {}),
      ...(toOptionalDecimal(tributos.pis.valor) !== undefined ? { valor: toOptionalDecimal(tributos.pis.valor) } : {}),
    },
    cofins: {
      ...(normalizeDoc(tributos.cofins.cst).slice(0, 2) ? { cst: normalizeDoc(tributos.cofins.cst).slice(0, 2) } : {}),
      ...(toOptionalDecimal(tributos.cofins.baseCalculo) !== undefined ? { baseCalculo: toOptionalDecimal(tributos.cofins.baseCalculo) } : {}),
      ...(toOptionalDecimal(tributos.cofins.aliquota) !== undefined ? { aliquota: toOptionalDecimal(tributos.cofins.aliquota) } : {}),
      ...(toOptionalDecimal(tributos.cofins.valor) !== undefined ? { valor: toOptionalDecimal(tributos.cofins.valor) } : {}),
    },
  };
}

function mapNfeItem(item: NfeItemForm): NfeItemInput {
  return mapNfeItemForPlugnotas(item, mapNfeTributos(item.tributos));
}

export function computeNfeItemsTotal(itens: NfeItemForm[]): number {
  return itens.reduce((acc, item) => acc + (getNfeItemLineTotal(item) ?? 0), 0);
}

export function buildNfeLikePayloadFromForm(form: NfeLikeForm, documentType: NotaDocumentType): NfeLikePayloadInput {
  const destDoc = normalizeDoc(form.destinatarioCpfCnpj);
  const indIEDest = normalizeDestinatarioIndIeDest(form.destinatarioIndIEDest);
  const ieFields = buildDestinatarioIePayload(indIEDest, form.destinatarioInscricaoEstadual);
  const enderecoPayload =
    documentType === 'NFE' ? mapDestinatarioEnderecoToPayload(form.destinatarioEndereco) : undefined;
  const destinatario: NfeEmitenteDestinatarioInput | undefined =
    destDoc || form.destinatarioRazaoSocial.trim() || form.destinatarioEmail.trim()
      ? {
          cpfCnpj: destDoc || '',
          ...(form.destinatarioRazaoSocial.trim() ? { razaoSocial: form.destinatarioRazaoSocial.trim() } : {}),
          ...(form.destinatarioEmail.trim() ? { email: form.destinatarioEmail.trim() } : {}),
          ...ieFields,
          ...(enderecoPayload ? { endereco: enderecoPayload } : {}),
        }
      : undefined;

  const itens = form.itens.map(mapNfeItem);
  const total = computeNfeItemsTotal(form.itens);

  return {
    ...(form.idIntegracao.trim() ? { idIntegracao: form.idIntegracao.trim() } : {}),
    modelo: documentType === 'NFE' ? '55' : '65',
    natureza: form.natureza.trim() || 'VENDA',
    ...(documentType === 'NFE'
      ? {
          consumidorFinal: resolveNfeConsumidorFinal(
            destDoc,
            indIEDest,
            form.destinatarioInscricaoEstadual,
          ),
        }
      : {}),
    emitente: {
      cpfCnpj: normalizeDoc(form.emitenteCpfCnpj),
      ...(form.emitenteRazaoSocial.trim() ? { razaoSocial: form.emitenteRazaoSocial.trim() } : {}),
      ...(form.emitenteInscricaoEstadual.trim() ? { inscricaoEstadual: form.emitenteInscricaoEstadual.trim() } : {}),
    },
    ...(destinatario ? { destinatario } : {}),
    itens,
    ...(total > 0 ? { pagamentos: buildDefaultNfePagamentos(total) } : {}),
    ...(form.informacoesComplementares.trim() ? { informacoesComplementares: form.informacoesComplementares.trim() } : {}),
    config: { producao: true },
  };
}
