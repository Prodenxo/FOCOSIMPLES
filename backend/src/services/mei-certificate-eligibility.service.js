import { badRequest } from '../utils/errors.js';
import { env } from '../config/env.js';
import { lookupCnpjBrasilApi } from './cnpj-lookup.service.js';

export const MEI_CERT_CPF_NOT_ALLOWED = 'MEI_CERT_CPF_NOT_ALLOWED';
export const MEI_CERT_CNPJ_NOT_MEI = 'MEI_CERT_CNPJ_NOT_MEI';
export const MEI_CERT_MEI_LOOKUP_FAILED = 'MEI_CERT_MEI_LOOKUP_FAILED';

const isEnforceMeiCertEnabled = () => {
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
 * Política estrita Mei Infinito: só aceita CNPJ com optante MEI confirmado na Receita.
 * Simples Nacional, LTDA, EPP, e-CPF e demais regimes são bloqueados.
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

const buildEligibilityError = (signal) => {
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

/**
 * Valida documento extraído do certificado (.pfx) antes de persistir / enviar ao Plugnotas.
 * @param {string|null|undefined} certDocument — só dígitos (CPF ou CNPJ)
 */
export const assertMeiCertificateEligible = async (certDocument) => {
  if (!isEnforceMeiCertEnabled()) {
    return { enforced: false, skipped: true };
  }

  const digits = String(certDocument || '').replace(/\D/g, '');
  if (!digits) {
    throw badRequest(
      'Não foi possível identificar o CPF/CNPJ no certificado digital. Use um certificado e-CNPJ válido do MEI.',
      { code: MEI_CERT_CNPJ_NOT_MEI, meiEligibilitySignal: 'doc_missing' }
    );
  }

  if (digits.length === 11) {
    throw badRequest(
      'Este certificado é de pessoa física (e-CPF). A área MEI exige certificado digital e-CNPJ do microempreendedor.',
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

  const verdict = classifyCnpjMeiEligibility(lookup);
  if (!verdict.eligible) {
    throw buildEligibilityError(verdict.signal);
  }

  return { enforced: true, skipped: false, signal: verdict.signal, cnpj: digits };
};
