/**
 * Utilitários para validação e construção de formulários de emissão fiscal.
 * Apenas JavaScript, sem TypeScript.
 */

import { applyCatalogProdutoToNfseServico } from '@/lib/nfseCatalogProdutoMetadata';
import { mapCatalogProdutoToNfeItem } from '@/lib/mapCatalogProdutoToNfeItem';
import { getNfseObraValidationMessage } from '@/lib/nfseObraForm';

/** Normaliza para apenas dígitos. */
export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Aplica máscara de CPF ou CNPJ. */
export function maskCpfCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Aplica máscara de CEP. */
export function maskCep(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Aplica máscara monetária BR. */
export function maskMoney(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  return `${reais || '0'},${cents}`;
}

/** Converte string BR em número. */
export function parseMoney(value) {
  const digits = onlyDigits(value);
  if (!digits) return 0;
  return Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

/** Converte string decimal em número. Aceita vírgula. */
export function parseDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Valida dígitos verificadores do CNPJ. */
export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base) => {
    let pos = base.length - 7;
    let sum = 0;
    for (let i = base.length; i >= 1; i -= 1) {
      sum += Number(base[base.length - i]) * pos;
      pos -= 1;
      if (pos < 2) pos = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + d1);
  return cnpj.slice(12) === `${d1}${d2}`;
}

/** Valida dígitos verificadores do CPF. */
export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  const calc = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) sum += Number(base[i]) * (base.length + 1 - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cpf.slice(0, 9));
  const d2 = calc(cpf.slice(0, 9) + d1);
  return cpf.slice(9) === `${d1}${d2}`;
}

/** Valida CPF ou CNPJ. */
export function isValidCpfCnpj(value) {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCpf(value);
  if (d.length === 14) return isValidCnpj(value);
  return false;
}

/** Tipos de IE do destinatário. */
export const DESTINATARIO_IE_OPTIONS = [
  { value: '9', label: 'Não contribuinte', hint: 'Consumidor, condomínio ou pessoa física.' },
  { value: '2', label: 'Isento de IE', hint: 'Pessoa jurídica isenta de Inscrição Estadual.' },
  { value: '1', label: 'Contribuinte ICMS', hint: 'Informe a IE do destinatário (cliente).' },
];

export const DEFAULT_DESTINATARIO_IND_IE_DEST = '9';

/** Defaults fiscais. */
export const DEFAULT_NFE_CSOSN = '102';
export const DEFAULT_NFE_PIS_COFINS_CST = '49';
export const NFSE_SERVICO_CODIGO_MIN_LENGTH = 6;

/** Normaliza código de serviço removendo pontos/traços. */
export function normalizeCodigoServico(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

/** Estado inicial do formulário de emissão NFS-e. */
export function getDefaultNfseForm() {
  return {
    prestadorCpfCnpj: '',
    prestadorRazaoSocial: '',
    prestadorInscricaoMunicipal: '',
    prestadorEmail: '',
    prestadorEndereco: {
      logradouro: '',
      numero: '',
      codigoCidade: '',
      cep: '',
      complemento: '',
      bairro: '',
      estado: '',
      descricaoCidade: '',
    },
    tomadorCpfCnpj: '',
    tomadorRazaoSocial: '',
    tomadorEmail: '',
    tomadorEndereco: {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      codigoCidade: '',
      descricaoCidade: '',
      estado: '',
    },
    servico: {
      codigo: '',
      cnae: '',
      discriminacao: '',
      aliquota: '',
      valorServico: '',
      codigoNbs: '',
      cIndOp: '',
      obra: { usarEnderecoTomador: true, cno: '', cei: '', art: '', codigoObra: '' },
    },
    cidadePrestacao: { codigo: '', descricao: '', estado: '' },
    informacoesComplementares: '',
    enviarEmail: true,
  };
}

/** Estado inicial do formulário NF-e/NFC-e. */
export function getDefaultNfeLikeForm() {
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
    destinatarioEndereco: {
      cep: '', logradouro: '', numero: '', complemento: '',
      bairro: '', codigoCidade: '', descricaoCidade: '', estado: '',
    },
    enviarEmail: true,
    informacoesComplementares: '',
    itens: [getDefaultNfeItem()],
  };
}

/** Estado inicial de um item NF-e/NFC-e. */
export function getDefaultNfeItem() {
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
    tributos: {
      icms: { origem: '0', cst: '', csosn: DEFAULT_NFE_CSOSN, modalidadeBaseCalculo: '', baseCalculo: '', aliquota: '', valor: '' },
      ipi: { cst: '', codigoEnquadramentoLegal: '', baseCalculo: '', aliquota: '', valor: '' },
      pis: { cst: DEFAULT_NFE_PIS_COFINS_CST, baseCalculo: '', aliquota: '', valor: '' },
      cofins: { cst: DEFAULT_NFE_PIS_COFINS_CST, baseCalculo: '', aliquota: '', valor: '' },
    },
  };
}

/** Total da linha do item NF-e/NFC-e. */
export function getNfeItemLineTotal(item) {
  const qty = parseDecimal(item?.quantidade) ?? 0;
  const unit = parseDecimal(item?.valorUnitario) ?? 0;
  const desc = parseDecimal(item?.desconto) ?? 0;
  if (qty <= 0 || unit <= 0) return 0;
  return Math.max(0, qty * unit - desc);
}

/** Soma total dos itens. */
export function computeNfeItemsTotal(itens) {
  return (itens || []).reduce((acc, item) => acc + (getNfeItemLineTotal(item) || 0), 0);
}

/** Validação do formulário NFS-e. Retorna mensagem de erro ou null. */
export function validateNfseForm(form) {
  if (!form) return 'Formulário vazio.';
  if (onlyDigits(form.prestadorCpfCnpj).length !== 14) return 'Informe um CNPJ válido do prestador.';
  if (!form.prestadorEndereco?.logradouro?.trim()) return 'Informe o logradouro do prestador.';
  if (!form.prestadorEndereco?.numero?.trim()) return 'Informe o número do endereço do prestador.';
  if (!form.prestadorEndereco?.codigoCidade?.trim()) return 'Informe o código IBGE da cidade do prestador.';
  if (onlyDigits(form.prestadorEndereco?.cep).length !== 8) return 'Informe um CEP válido do prestador (8 dígitos).';

  const tomadorDoc = onlyDigits(form.tomadorCpfCnpj);
  if (!tomadorDoc) return 'Informe o CPF/CNPJ do tomador.';
  if (tomadorDoc.length !== 11 && tomadorDoc.length !== 14) return 'CPF/CNPJ do tomador inválido.';
  if (!isValidCpfCnpj(tomadorDoc)) return 'CPF/CNPJ do tomador inválido.';
  if (!form.tomadorRazaoSocial?.trim()) return 'Informe a razão social do tomador.';

  if (tomadorDoc.length === 14) {
    const e = form.tomadorEndereco || {};
    if (onlyDigits(e.cep).length !== 8) return 'Para tomador CNPJ, informe o CEP (8 dígitos).';
    if (!e.logradouro?.trim()) return 'Para tomador CNPJ, informe o logradouro.';
    if (!e.numero?.trim()) return 'Para tomador CNPJ, informe o número.';
    if (!e.bairro?.trim()) return 'Para tomador CNPJ, informe o bairro.';
    if (onlyDigits(e.codigoCidade).length !== 7) return 'Para tomador CNPJ, informe o código IBGE (7 dígitos).';
    if (!e.descricaoCidade?.trim()) return 'Para tomador CNPJ, informe a cidade.';
    if ((e.estado || '').trim().length !== 2) return 'Para tomador CNPJ, informe a UF (2 letras).';
  }

  const servico = form.servico || {};
  if (!servico.codigo?.trim() || !servico.cnae?.trim() || !servico.discriminacao?.trim() || !servico.valorServico?.toString().trim()) {
    return 'Preencha os campos obrigatórios do serviço.';
  }
  const codigoNorm = normalizeCodigoServico(servico.codigo);
  if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
    return `Código do serviço deve ter pelo menos ${NFSE_SERVICO_CODIGO_MIN_LENGTH} dígitos (ex.: 17.19.01 → 171901).`;
  }
  if (servico.aliquota?.toString().trim()) {
    const a = parseDecimal(servico.aliquota);
    if (a === null || a < 0) return 'Informe uma alíquota ISS válida.';
  }
  const valorServico = parseDecimal(servico.valorServico);
  if (!valorServico || valorServico <= 0) return 'Informe um valor de serviço maior que zero.';

  const obraMsg = getNfseObraValidationMessage(
    servico.codigo,
    servico.obra,
    form.tomadorEndereco,
  );
  if (obraMsg) return obraMsg;

  return null;
}

/** Validação do formulário NF-e/NFC-e. Retorna mensagem de erro ou null. */
export function validateNfeLikeForm(form, documentType) {
  const label = documentType === 'NFE' ? 'NF-e' : 'NFC-e';
  if (onlyDigits(form.emitenteCpfCnpj).length !== 14) return `CNPJ do emitente da ${label} é obrigatório.`;
  if (!isValidCnpj(form.emitenteCpfCnpj)) return `Informe um CNPJ válido do emitente da ${label}.`;
  const destDoc = onlyDigits(form.destinatarioCpfCnpj);
  if (!destDoc) return `CPF/CNPJ do destinatário da ${label} é obrigatório.`;
  if (!isValidCpfCnpj(destDoc)) return `CPF/CNPJ do destinatário da ${label} inválido.`;
  if (!form.destinatarioRazaoSocial?.trim()) return `Informe a razão social do destinatário da ${label}.`;
  if (documentType === 'NFE') {
    if (!form.emitenteInscricaoEstadual?.trim()) {
      return 'Informe a Inscrição Estadual do emitente (obrigatória na NF-e de mercadoria). Use ISENTO se for o caso.';
    }
  }
  if (form.destinatarioIndIEDest === '1' && !form.destinatarioInscricaoEstadual?.trim()) {
    return 'Informe a Inscrição Estadual do destinatário (contribuinte ICMS).';
  }
  if (documentType === 'NFE') {
    const e = form.destinatarioEndereco || {};
    if (onlyDigits(e.cep).length !== 8) return `Informe o CEP do destinatário da ${label} (8 dígitos).`;
    if (!e.logradouro?.trim()) return `Informe o logradouro do destinatário da ${label}.`;
    if (!e.numero?.trim()) return `Informe o número do destinatário da ${label}.`;
    if (!e.bairro?.trim()) return `Informe o bairro do destinatário da ${label}.`;
    if (onlyDigits(e.codigoCidade).length !== 7) return `Informe o código IBGE do destinatário da ${label} (7 dígitos).`;
    if (!e.descricaoCidade?.trim()) return `Informe a cidade do destinatário da ${label}.`;
    if ((e.estado || '').trim().length !== 2) return `Informe a UF do destinatário da ${label} (2 letras).`;
  }
  if (!Array.isArray(form.itens) || form.itens.length === 0) return `Adicione ao menos um item para emitir ${label}.`;
  for (let i = 0; i < form.itens.length; i += 1) {
    const item = form.itens[i];
    const linha = i + 1;
    if (!item.codigo?.trim()) return `Item ${linha}: informe o código.`;
    if (!item.descricao?.trim()) return `Item ${linha}: informe a descrição.`;
    if (onlyDigits(item.ncm).length !== 8) return `Item ${linha}: NCM deve conter 8 dígitos.`;
    if (onlyDigits(item.cfop).length !== 4) return `Item ${linha}: CFOP deve ter 4 dígitos.`;
    if (!item.unidade?.trim()) return `Item ${linha}: informe a unidade comercial.`;
    const q = parseDecimal(item.quantidade);
    if (!q || q <= 0) return `Item ${linha}: quantidade deve ser maior que zero.`;
    const v = parseDecimal(item.valorUnitario);
    if (v === null || v <= 0) return `Item ${linha}: valor unitário deve ser maior que zero.`;
    const csosn = onlyDigits(item.tributos?.icms?.csosn);
    const cst = onlyDigits(item.tributos?.icms?.cst);
    if (csosn && csosn.length !== 3) return `Item ${linha}: CSOSN do ICMS deve ter 3 dígitos (ex.: 102).`;
    if (!csosn && (!cst || cst.length < 2 || cst.length > 3)) return `Item ${linha}: informe CSOSN (3 dígitos) ou CST (2 ou 3 dígitos) do ICMS.`;
    const pisCst = onlyDigits(item.tributos?.pis?.cst);
    if (!pisCst) return `Item ${linha}: informe CST do PIS (ex.: 49).`;
    if (pisCst.length > 2) return `Item ${linha}: CST do PIS deve ter no máximo 2 dígitos.`;
    const cofinsCst = onlyDigits(item.tributos?.cofins?.cst);
    if (!cofinsCst) return `Item ${linha}: informe CST do COFINS (ex.: 49).`;
    if (cofinsCst.length > 2) return `Item ${linha}: CST do COFINS deve ter no máximo 2 dígitos.`;
  }
  return null;
}

/** Constrói payload para emissão NFS-e. */
export function buildNfsePayload(form) {
  const servico = {
    codigo: normalizeCodigoServico(form.servico.codigo),
    cnae: onlyDigits(form.servico.cnae),
    discriminacao: String(form.servico.discriminacao || '').trim(),
    valorServico: parseDecimal(form.servico.valorServico) ?? 0,
    ...(form.servico.aliquota?.toString().trim() ? { aliquota: parseDecimal(form.servico.aliquota) ?? 0 } : {}),
    ...(form.servico.codigoNbs?.trim() ? { codigoNbs: onlyDigits(form.servico.codigoNbs) } : {}),
    ...(form.servico.cIndOp?.trim() ? { cIndOp: form.servico.cIndOp.trim() } : {}),
    obra: { usarEnderecoTomador: Boolean(form.servico.obra?.usarEnderecoTomador) },
    ...(form.servico.obra?.cno?.trim() ? { obra: { ...form.servico.obra, cno: form.servico.obra.cno.trim() } } : {}),
  };

  return {
    prestadorCpfCnpj: onlyDigits(form.prestadorCpfCnpj),
    prestadorRazaoSocial: String(form.prestadorRazaoSocial || '').trim() || undefined,
    prestadorInscricaoMunicipal: String(form.prestadorInscricaoMunicipal || '').trim() || undefined,
    prestadorEmail: String(form.prestadorEmail || '').trim() || undefined,
    prestadorEndereco: {
      logradouro: form.prestadorEndereco.logradouro.trim(),
      numero: form.prestadorEndereco.numero.trim(),
      codigoCidade: onlyDigits(form.prestadorEndereco.codigoCidade),
      cep: onlyDigits(form.prestadorEndereco.cep),
      ...(form.prestadorEndereco.complemento?.trim() ? { complemento: form.prestadorEndereco.complemento.trim() } : {}),
      bairro: form.prestadorEndereco.bairro.trim(),
      estado: form.prestadorEndereco.estado.trim().toUpperCase(),
      descricaoCidade: form.prestadorEndereco.descricaoCidade.trim(),
    },
    tomadorCpfCnpj: onlyDigits(form.tomadorCpfCnpj),
    tomadorRazaoSocial: String(form.tomadorRazaoSocial || '').trim(),
    tomadorEmail: String(form.tomadorEmail || '').trim() || undefined,
    tomadorEndereco: {
      logradouro: form.tomadorEndereco.logradouro.trim(),
      numero: form.tomadorEndereco.numero.trim(),
      codigoCidade: onlyDigits(form.tomadorEndereco.codigoCidade),
      cep: onlyDigits(form.tomadorEndereco.cep),
      ...(form.tomadorEndereco.complemento?.trim() ? { complemento: form.tomadorEndereco.complemento.trim() } : {}),
      bairro: form.tomadorEndereco.bairro.trim(),
      estado: form.tomadorEndereco.estado.trim().toUpperCase(),
      descricaoCidade: form.tomadorEndereco.descricaoCidade.trim(),
    },
    servico,
    cidadePrestacao: form.cidadePrestacao?.codigo
      ? { codigo: onlyDigits(form.cidadePrestacao.codigo), descricao: form.cidadePrestacao.descricao || '', estado: form.cidadePrestacao.estado || '' }
      : undefined,
    informacoesComplementares: String(form.informacoesComplementares || '').trim() || undefined,
    enviarEmail: Boolean(form.enviarEmail),
  };
}

/** Constrói payload para emissão NF-e/NFC-e. */
export function buildNfeLikePayload(form, documentType) {
  const destDoc = onlyDigits(form.destinatarioCpfCnpj);
  const indIEDest = String(form.destinatarioIndIEDest || '9');
  const ieFields = indIEDest === '1'
    ? { indIEDest, inscricaoEstadual: onlyDigits(form.destinatarioInscricaoEstadual) }
    : { indIEDest };

  const destinatario = {
    cpfCnpj: destDoc,
    razaoSocial: form.destinatarioRazaoSocial.trim(),
    email: form.destinatarioEmail.trim() || undefined,
    ...ieFields,
    ...(documentType === 'NFE'
      ? {
          endereco: {
            cep: onlyDigits(form.destinatarioEndereco.cep),
            logradouro: form.destinatarioEndereco.logradouro.trim(),
            numero: form.destinatarioEndereco.numero.trim(),
            bairro: form.destinatarioEndereco.bairro.trim(),
            codigoCidade: onlyDigits(form.destinatarioEndereco.codigoCidade),
            descricaoCidade: form.destinatarioEndereco.descricaoCidade.trim(),
            estado: form.destinatarioEndereco.estado.trim().toUpperCase(),
            ...(form.destinatarioEndereco.complemento?.trim() ? { complemento: form.destinatarioEndereco.complemento.trim() } : {}),
          },
        }
      : {}),
  };

  const itens = (form.itens || []).map((item) => ({
    codigo: String(item.codigo || '').trim(),
    descricao: String(item.descricao || '').trim(),
    ncm: onlyDigits(item.ncm),
    cfop: onlyDigits(item.cfop),
    unidade: String(item.unidade || 'UN').trim().toUpperCase(),
    quantidade: parseDecimal(item.quantidade) ?? 1,
    valorUnitario: parseDecimal(item.valorUnitario) ?? 0,
    desconto: parseDecimal(item.desconto) ?? 0,
    ...(item.cest?.trim() ? { cest: onlyDigits(item.cest) } : {}),
    ...(item.sku?.trim() ? { sku: item.sku.trim() } : {}),
    tributos: {
      icms: {
        origem: String(item.tributos?.icms?.origem || '0'),
        ...(onlyDigits(item.tributos?.icms?.csosn) ? { csosn: onlyDigits(item.tributos.icms.csosn) } : {}),
        ...(onlyDigits(item.tributos?.icms?.cst) ? { cst: onlyDigits(item.tributos.icms.cst) } : {}),
      },
      pis: { cst: onlyDigits(item.tributos?.pis?.cst) || DEFAULT_NFE_PIS_COFINS_CST },
      cofins: { cst: onlyDigits(item.tributos?.cofins?.cst) || DEFAULT_NFE_PIS_COFINS_CST },
    },
  }));

  const total = computeNfeItemsTotal(form.itens);

  return {
    ...(form.idIntegracao?.trim() ? { idIntegracao: form.idIntegracao.trim() } : {}),
    modelo: documentType === 'NFE' ? '55' : '65',
    natureza: form.natureza?.trim() || 'VENDA',
    consumidorFinal: documentType === 'NFE' ? indIEDest !== '1' : true,
    emitente: {
      cpfCnpj: onlyDigits(form.emitenteCpfCnpj),
      razaoSocial: form.emitenteRazaoSocial.trim(),
      inscricaoEstadual: form.emitenteInscricaoEstadual.trim(),
    },
    destinatario,
    itens,
    ...(total > 0 ? { pagamentos: [{ meio: '99', valor: total, descricaoMeio: 'Outros' }] } : {}),
    informacoesComplementares: form.informacoesComplementares.trim() || undefined,
    config: { producao: true },
    enviarEmail: Boolean(form.enviarEmail),
  };
}

/** Aplica prefill do cliente (catálogo) ao formulário NFS-e. */
export function applyClienteToNfseForm(cliente) {
  if (!cliente) return {};
  const meta = cliente.metadata_json || {};
  const doc = onlyDigits(cliente.documento || '');
  const endereco = meta.endereco || {};
  return {
    tomadorCpfCnpj: doc,
    tomadorRazaoSocial: String(cliente.nome || '').trim(),
    tomadorEmail: String(cliente.email || '').trim(),
    tomadorEndereco: {
      cep: onlyDigits(endereco.cep || '').slice(0, 8),
      logradouro: String(endereco.logradouro || '').trim(),
      numero: String(endereco.numero || '').trim(),
      complemento: String(endereco.complemento || '').trim(),
      bairro: String(endereco.bairro || '').trim(),
      codigoCidade: onlyDigits(endereco.codigoCidade || '').slice(0, 7),
      descricaoCidade: String(endereco.descricaoCidade || '').trim(),
      estado: String(endereco.estado || '').trim().toUpperCase().slice(0, 2),
    },
  };
}

/** Aplica prefill do cliente ao formulário NF-e/NFC-e. */
export function applyClienteToNfeForm(cliente) {
  if (!cliente) return {};
  const meta = cliente.metadata_json || {};
  const doc = onlyDigits(cliente.documento || '');
  const endereco = meta.endereco || {};
  return {
    destinatarioCpfCnpj: doc,
    destinatarioRazaoSocial: String(cliente.nome || '').trim(),
    destinatarioEmail: String(cliente.email || '').trim(),
    destinatarioIndIEDest: String(meta.indIEDest || DEFAULT_DESTINATARIO_IND_IE_DEST),
    destinatarioInscricaoEstadual: String(meta.inscricaoEstadual || '').trim(),
    destinatarioEndereco: {
      cep: onlyDigits(endereco.cep || '').slice(0, 8),
      logradouro: String(endereco.logradouro || '').trim(),
      numero: String(endereco.numero || '').trim(),
      complemento: String(endereco.complemento || '').trim(),
      bairro: String(endereco.bairro || '').trim(),
      codigoCidade: onlyDigits(endereco.codigoCidade || '').slice(0, 7),
      descricaoCidade: String(endereco.descricaoCidade || '').trim(),
      estado: String(endereco.estado || '').trim().toUpperCase().slice(0, 2),
    },
  };
}

/** Aplica prefill do produto (catálogo) ao item NF-e. */
export function applyProdutoToNfeItem(produto) {
  if (!produto) return mapCatalogProdutoToNfeItem({});
  return mapCatalogProdutoToNfeItem(produto);
}

/** Aplica prefill do produto (catálogo) ao serviço NFS-e. */
export function applyProdutoToNfseServico(produto) {
  if (!produto) return {};
  const fromCatalog = applyCatalogProdutoToNfseServico(produto);
  return {
    ...fromCatalog,
    discriminacao: String(fromCatalog.discriminacao || produto.nome || '').trim(),
    aliquota: fromCatalog.aliquota
      ? String(fromCatalog.aliquota).replace('.', ',')
      : '',
    valorServico: produto.valor_sugerido
      ? String(produto.valor_sugerido.toFixed(2)).replace('.', ',')
      : fromCatalog.valorServico,
  };
}
