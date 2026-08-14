/**
 * Validação estrutural de payload NF-e/NFC-e — compartilhada entre emissão e testes fiscais.
 */
import { badRequest } from '../utils/errors.js';
import {
  extractNfeItemQuantidade,
  extractNfeItemValorUnitario,
} from '../services/plugnotas/plugnotas-nfe-payload.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const isValidCnpj = (value) => normalizeDoc(value).length === 14;

const isValidCpfOrCnpj = (value) => {
  const digits = normalizeDoc(value);
  return !digits || digits.length === 11 || digits.length === 14;
};

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

/**
 * @param {object} payload
 * @param {{ label?: string }} [options]
 */
export const validateNfeLikePayload = (payload, { label = 'NF-e' } = {}) => {
  const emitenteDoc = normalizeDoc(payload?.emitente?.cpfCnpj || '');
  if (!emitenteDoc) {
    throw badRequest(`CNPJ do emitente da ${label} é obrigatório`);
  }
  if (!isValidCnpj(emitenteDoc)) {
    throw badRequest(`CNPJ do emitente da ${label} deve ter 14 dígitos`);
  }

  const destinatarioDoc = normalizeDoc(payload?.destinatario?.cpfCnpj || '');
  if (!destinatarioDoc) {
    throw badRequest(`CPF/CNPJ do destinatário da ${label} é obrigatório`);
  }
  if (!isValidCpfOrCnpj(destinatarioDoc)) {
    throw badRequest(`CPF/CNPJ do destinatário da ${label} inválido`);
  }
  const destinatarioNome = String(payload?.destinatario?.razaoSocial || '').trim();
  if (!destinatarioNome) {
    throw badRequest(`Razão social do destinatário da ${label} é obrigatória`);
  }

  if (label === 'NF-e') {
    const endereco = payload?.destinatario?.endereco;
    const cep = normalizeDoc(endereco?.cep || '');
    if (cep.length !== 8) {
      throw badRequest('CEP do destinatário da NF-e deve ter 8 dígitos');
    }
    if (!String(endereco?.logradouro || '').trim()) {
      throw badRequest('Logradouro do destinatário da NF-e é obrigatório');
    }
    if (!String(endereco?.numero || '').trim()) {
      throw badRequest('Número do endereço do destinatário da NF-e é obrigatório');
    }
    if (!String(endereco?.bairro || '').trim()) {
      throw badRequest('Bairro do destinatário da NF-e é obrigatório');
    }
    const codigoCidade = normalizeDoc(endereco?.codigoCidade || '');
    if (codigoCidade.length !== 7) {
      throw badRequest('Código IBGE da cidade do destinatário da NF-e deve ter 7 dígitos');
    }
    if (!String(endereco?.descricaoCidade || '').trim()) {
      throw badRequest('Cidade do destinatário da NF-e é obrigatória');
    }
    const uf = String(endereco?.estado || '').trim().toUpperCase();
    if (uf.length !== 2) {
      throw badRequest('UF do destinatário da NF-e deve ter 2 letras');
    }
  }

  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  if (!itens.length) {
    throw badRequest(`Itens da ${label} são obrigatórios`);
  }

  itens.forEach((item, index) => {
    const itemPos = index + 1;
    const codigo = String(item?.codigo || item?.sku || '').trim();
    if (!codigo) {
      throw badRequest(`Item ${itemPos} da ${label}: código é obrigatório`);
    }

    const descricao = String(item?.descricao || '').trim();
    if (!descricao) {
      throw badRequest(`Item ${itemPos} da ${label}: descrição é obrigatória`);
    }

    const ncm = normalizeDoc(item?.ncm || '');
    if (ncm.length !== 8) {
      throw badRequest(`Item ${itemPos} da ${label}: NCM deve ter 8 dígitos`);
    }

    const cfop = normalizeDoc(item?.cfop || '');
    if (cfop.length !== 4) {
      throw badRequest(`Item ${itemPos} da ${label}: CFOP deve ter 4 dígitos`);
    }

    const unidade = String(item?.unidade || item?.unidadeComercial || '').trim();
    if (!unidade) {
      throw badRequest(`Item ${itemPos} da ${label}: unidade é obrigatória`);
    }

    const quantidade = extractNfeItemQuantidade(item);
    if (quantidade === null || quantidade <= 0) {
      throw badRequest(`Item ${itemPos} da ${label}: quantidade deve ser maior que zero`);
    }

    const valorUnitario = extractNfeItemValorUnitario(item);
    if (valorUnitario === null || valorUnitario <= 0) {
      throw badRequest(`Item ${itemPos} da ${label}: valor unitário deve ser maior que zero`);
    }

    const tributos = toObject(item?.tributos);
    const icms = toObject(tributos?.icms);
    const pis = toObject(tributos?.pis);
    const cofins = toObject(tributos?.cofins);
    const hasIcmsCode = String(icms?.cst || '').trim() || String(icms?.csosn || '').trim();
    if (!hasIcmsCode) {
      throw badRequest(`Item ${itemPos} da ${label}: informe CST ou CSOSN do ICMS`);
    }
    if (!String(pis?.cst || '').trim()) {
      throw badRequest(`Item ${itemPos} da ${label}: CST do PIS é obrigatório`);
    }
    if (!String(cofins?.cst || '').trim()) {
      throw badRequest(`Item ${itemPos} da ${label}: CST do COFINS é obrigatório`);
    }
  });
};
