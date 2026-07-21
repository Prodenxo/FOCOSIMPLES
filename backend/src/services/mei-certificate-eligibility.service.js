import { badRequest } from '../utils/errors.js';
import { env } from '../config/env.js';
import { lookupCnpjBrasilApi } from './cnpj-lookup.service.js';

export const MEI_CERT_CPF_NOT_ALLOWED = 'MEI_CERT_CPF_NOT_ALLOWED';
export const MEI_CERT_CNPJ_NOT_MEI = 'MEI_CERT_CNPJ_NOT_MEI';
export const MEI_CERT_MEI_LOOKUP_FAILED = 'MEI_CERT_MEI_LOOKUP_FAILED';
export const SIMPLES_CERT_CNPJ_NOT_SIMPLES = 'SIMPLES_CERT_CNPJ_NOT_SIMPLES';

const isFocoSimplesProduct = () =>
  String(process.env.APP_PRODUCT || env.APP_PRODUCT || '')
    .trim()
    .toLowerCase() === 'focosimples';

const isEnforceMeiCertEnabled = () => {
  // Foco Simples: não exige MEI; usa política de Simples Nacional abaixo.
  if (isFocoSimplesProduct()) return true;
  const raw = String(process.env.MEI_CERT_ENFORCE_MEI_CNPJ ?? env.MEI_CERT_ENFORCE_MEI_CNPJ ?? 'true')
    .trim()
    .toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
};

const normalizeSituacao = (value) => String(value || '').trim().toUpperCase();

const normalizeOpcaoBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'sim' || text === 'true') return true;
  if (text === 'nao' || text === 'não' || text === 'false') return false;
  return null;
};

/**
 * Política estrita Mei Infinito / FocoMEI: só aceita CNPJ com optante MEI confirmado.
 * Simples Nacional sem MEI, LTDA, EPP, e-CPF e demais regimes são bloqueados.
 *
 * @param {Record<string, unknown>|null|undefined} lookup
 * @returns {{ eligible: boolean, signal: string }}
 */
export const classifyCnpjMeiEligibility = (lookup) => {
  if (!lookup || typeof lookup !== 'object') {
    return { eligible: false, signal: 'lookup_empty' };
  }

  const situacao = normalizeSituacao(lookup.situacaoCadastral);
  if (situacao && !situacao.includes('ATIVA')) {
    return { eligible: false, signal: 'situacao_nao_ativa' };
  }

  const opcaoMei = normalizeOpcaoBoolean(lookup.opcaoMei);
  if (opcaoMei === true) {
    return { eligible: true, signal: 'opcao_mei_true' };
  }

  if (opcaoMei === false) {
    return { eligible: false, signal: 'opcao_mei_false' };
  }

  const opcaoSimples = normalizeOpcaoBoolean(lookup.opcaoSimples);
  if (opcaoSimples === true) {
    return { eligible: false, signal: 'simples_sem_mei' };
  }

  return { eligible: false, signal: 'mei_nao_confirmado' };
};

/**
 * Política Foco Simples: aceita e-CNPJ de Simples Nacional (inclui MEI).
 * Bloqueia e-CPF e CNPJ fora do Simples / inativo.
 *
 * @param {Record<string, unknown>|null|undefined} lookup
 * @returns {{ eligible: boolean, signal: string }}
 */
export const classifyCnpjSimplesEligibility = (lookup) => {
  if (!lookup || typeof lookup !== 'object') {
    return { eligible: false, signal: 'lookup_empty' };
  }

  const situacao = normalizeSituacao(lookup.situacaoCadastral);
  if (situacao && !situacao.includes('ATIVA')) {
    return { eligible: false, signal: 'situacao_nao_ativa' };
  }

  const opcaoMei = normalizeOpcaoBoolean(lookup.opcaoMei);
  if (opcaoMei === true) {
    return { eligible: true, signal: 'opcao_mei_true' };
  }

  const opcaoSimples = normalizeOpcaoBoolean(lookup.opcaoSimples);
  if (opcaoSimples === true) {
    return { eligible: true, signal: 'opcao_simples_true' };
  }

  if (opcaoSimples === false) {
    return { eligible: false, signal: 'fora_do_simples' };
  }

  return { eligible: false, signal: 'simples_nao_confirmado' };
};

const buildMeiEligibilityError = (signal) => {
  if (signal === 'situacao_nao_ativa') {
    return badRequest(
      'Este CNPJ não está com situação cadastral ativa na Receita Federal. Regularize o cadastro antes de importar o certificado.',
      { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: signal }
    );
  }
  if (signal === 'simples_sem_mei') {
    return badRequest(
      'Este CNPJ está no Simples Nacional, mas não como MEI. O Mei Infinito aceita apenas certificado e-CNPJ de Microempreendedor Individual.',
      { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: signal }
    );
  }
  if (signal === 'lookup_empty' || signal === 'mei_nao_confirmado') {
    return badRequest(
      'Não foi possível confirmar que este CNPJ é MEI na Receita Federal. Verifique o enquadramento no Portal do Empreendedor.',
      { code: MEI_CERT_MEI_LOOKUP_FAILED, meiEligibilitySignal: signal }
    );
  }
  return badRequest(
    'Este CNPJ não está enquadrado como MEI na Receita Federal. O Mei Infinito aceita apenas certificado e-CNPJ de Microempreendedor Individual — Simples Nacional, LTDA e outros regimes não são permitidos.',
    { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: signal }
  );
};

const buildSimplesEligibilityError = (signal) => {
  if (signal === 'situacao_nao_ativa') {
    return badRequest(
      'Este CNPJ não está com situação cadastral ativa na Receita Federal. Regularize o cadastro antes de importar o certificado.',
      { code: SIMPLES_CERT_CNPJ_NOT_SIMPLES, meiEligibilitySignal: signal }
    );
  }
  if (signal === 'fora_do_simples') {
    return badRequest(
      'Este CNPJ não é optante do Simples Nacional. O Foco Simples aceita certificado e-CNPJ de empresas do Simples Nacional.',
      { code: SIMPLES_CERT_CNPJ_NOT_SIMPLES, meiEligibilitySignal: signal }
    );
  }
  if (signal === 'lookup_empty' || signal === 'simples_nao_confirmado') {
    return badRequest(
      'Não foi possível confirmar que este CNPJ está no Simples Nacional. Verifique o enquadramento na Receita Federal e tente novamente.',
      { code: MEI_CERT_MEI_LOOKUP_FAILED, meiEligibilitySignal: signal }
    );
  }
  return badRequest(
    'Este CNPJ não está elegível para emissão no Foco Simples. Use um certificado e-CNPJ de empresa optante do Simples Nacional.',
    { code: SIMPLES_CERT_CNPJ_NOT_SIMPLES, meiEligibilitySignal: signal }
  );
};

/**
 * Valida documento extraído do certificado (.pfx) antes de persistir / enviar ao Plugnotas.
 * FocoMEI: exige MEI. Foco Simples: exige Simples Nacional (e-CNPJ).
 * @param {string|null|undefined} certDocument — só dígitos (CPF ou CNPJ)
 */
export const assertMeiCertificateEligible = async (certDocument) => {
  const focosimples = isFocoSimplesProduct();

  if (!focosimples && !isEnforceMeiCertEnabled()) {
    return { enforced: false, skipped: true };
  }

  const digits = String(certDocument || '').replace(/\D/g, '');
  if (!digits) {
    throw badRequest(
      focosimples
        ? 'Não foi possível identificar o CPF/CNPJ no certificado digital. Use um certificado e-CNPJ válido da empresa.'
        : 'Não foi possível identificar o CPF/CNPJ no certificado digital. Use um certificado e-CNPJ válido do MEI.',
      { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: 'doc_missing' }
    );
  }

  if (digits.length === 11) {
    throw badRequest(
      focosimples
        ? 'Este certificado é de pessoa física (e-CPF). A emissão fiscal exige certificado digital e-CNPJ da empresa.'
        : 'Este certificado é de pessoa física (e-CPF). A área MEI exige certificado digital e-CNPJ do microempreendedor.',
      { code: MEI_CERT_CPF_NOT_ALLOWED, meiEligibilitySignal: 'ecpf' }
    );
  }

  if (digits.length !== 14) {
    throw badRequest(
      'Documento do certificado inválido. Informe um certificado e-CNPJ com 14 dígitos.',
      { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: 'invalid_doc_length' }
    );
  }

  let lookup;
  try {
    lookup = await lookupCnpjBrasilApi(digits);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    throw badRequest(
      msg || 'Falha ao consultar o CNPJ na Receita Federal. Tente novamente em instantes.',
      { code: MEI_CERT_MEI_LOOKUP_FAILED, meiEligibilitySignal: 'lookup_error' }
    );
  }

  if (focosimples) {
    const verdict = classifyCnpjSimplesEligibility(lookup);
    if (!verdict.eligible) {
      throw buildSimplesEligibilityError(verdict.signal);
    }
    return { enforced: true, skipped: false, signal: verdict.signal, cnpj: digits, product: 'focosimples' };
  }

  const verdict = classifyCnpjMeiEligibility(lookup);
  if (!verdict.eligible) {
    throw buildMeiEligibilityError(verdict.signal);
  }

  return { enforced: true, skipped: false, signal: verdict.signal, cnpj: digits, product: 'focomei' };
};
