/**
 * Validações antes do POST PlugNotas (mensagens simples para o usuário).
 * Não substitui autorização municipal — só evita payload incompleto/incoerente.
 */

import { badRequest } from '../utils/errors.js';
import { normalizeCodigoNbs, normalizeLc116CodigoKey } from './nfse-codigo-nbs.js';
import {
  formatNfseCodigoNbsOptionsMessage,
  hasNfseCorrelacaoForCodigo,
  isNfseCodigoNbsValidoForCodigo,
} from './nfse-correlacao-reforma.js';
import { requiresNfseObraForServicoCodigo } from './nfse-obra-defaults.js';
import { requiresIssnetRtcEmitSchema } from './nfse-reforma-defaults.js';

/** IBGE Ribeirão Preto — exige cTribMun alinhado à alíquota ISS (tabela ISSNET). */
export const NFSE_ISSNET_RIBEIRAO_IBGE = '3543402';

/**
 * @param {Record<string, unknown>} servico
 * @returns {string[]}
 */
export const collectNfseServicoCatalogCoherenceWarnings = (servico = {}) => {
  const warnings = [];
  const lcKey = normalizeLc116CodigoKey(servico.codigo);
  const nbs = normalizeCodigoNbs(servico.codigoNbs);
  const cnae = String(servico.cnae || '').replace(/\D/g, '').slice(0, 7);

  if (lcKey.startsWith('07') && nbs && !nbs.startsWith('101') && !nbs.startsWith('102')) {
    warnings.push(
      'O NBS informado não parece ser de construção civil (LC 07.xx). '
      + 'Confira com o contador se NBS, CNAE e código de serviço batem com a atividade real.',
    );
  }

  if (lcKey === '071601' && cnae && !cnae.startsWith('422') && !cnae.startsWith('432')) {
    warnings.push(
      `CNAE ${cnae} incomum para o serviço 07.16.01 (redes/obras). Revise o cadastro do produto fiscal.`,
    );
  }

  if (!nbs && requiresNfseObraForServicoCodigo(servico.codigo)) {
    warnings.push(
      'Serviço de obra (07.xx): informe o NBS de 9 dígitos no cadastro do serviço (Reforma Tributária).',
    );
  }

  return warnings;
};

/**
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ codigoIbge?: string }} [options]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export const validateNfseEmitPreflight = (payload, options = {}) => {
  const errors = [];
  const warnings = [];

  const codigoIbge = String(
    options.codigoIbge
    ?? payload?.prestador?.endereco?.codigoCidade
    ?? payload?.emitente?.codigoCidade
    ?? '',
  ).replace(/\D/g, '').slice(0, 7);

  const issnetRtc = requiresIssnetRtcEmitSchema(codigoIbge);
  const servicos = Array.isArray(payload?.servico)
    ? payload.servico
    : payload?.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];

  if (!servicos.length) {
    errors.push('Informe ao menos um serviço na nota.');
    return { errors, warnings };
  }

  for (const servico of servicos) {
    if (!servico || typeof servico !== 'object') continue;

    warnings.push(...collectNfseServicoCatalogCoherenceWarnings(servico));

    const codigo = String(servico.codigo || '').replace(/\D/g, '');
    if (codigo.length < 4) {
      errors.push('Código do serviço (LC 116) incompleto — use o código cadastrado (ex.: 071601).');
    }

    const nbs = normalizeCodigoNbs(servico.codigoNbs);
    if (issnetRtc && !nbs) {
      errors.push(
        'Para Ribeirão Preto (ISSNET), informe o NBS de 9 dígitos no serviço ou no produto fiscal.',
      );
    }

    // EM062: sem correlação oficial entre código do serviço e NBS a prefeitura rejeita.
    if (nbs && hasNfseCorrelacaoForCodigo(servico.codigo) && !isNfseCodigoNbsValidoForCodigo(servico.codigo, nbs)) {
      const opcoes = formatNfseCodigoNbsOptionsMessage(servico.codigo);
      errors.push(
        `O NBS ${nbs} não combina com o código de serviço ${codigo} na tabela oficial da NFS-e. `
        + `NBS aceitos para esse serviço: ${opcoes}.`,
      );
    }

    const cIndOp = String(servico.cIndOp ?? servico.ibscbs?.codigoOperacao ?? '').replace(/\D/g, '');
    if (issnetRtc && cIndOp.length !== 6) {
      errors.push(
        'Indicador de operação (cIndOp) com 6 dígitos é obrigatório para Ribeirão Preto — cadastre no produto fiscal.',
      );
    }

    if (issnetRtc) {
      const codigoTrib = String(servico.codigoTributacao || '').replace(/\D/g, '');
      if (codigoTrib.length < 3) {
        errors.push(
          'Falta o código do serviço na prefeitura (cTribMun). Cadastre no serviço do catálogo '
          + 'o código habilitado para a empresa no ISS.net (ex.: 71602) — peça ao contador.',
        );
      }
    }

    if (requiresNfseObraForServicoCodigo(servico.codigo)) {
      const cidade = payload.cidadePrestacao;
      const hasCidade = cidade && typeof cidade === 'object'
        && String(cidade.codigo || cidade.codigoCidade || '').replace(/\D/g, '').length === 7
        && String(cidade.cep || '').replace(/\D/g, '').length === 8
        && String(cidade.logradouro || '').trim();
      const obraEnd = servico?.obra?.endereco;
      const hasObraEnd = obraEnd && typeof obraEnd === 'object'
        && String(obraEnd.cep || '').replace(/\D/g, '').length === 8
        && String(obraEnd.logradouro || '').trim();
      if (!hasCidade && !hasObraEnd) {
        errors.push(
          'Serviço de obra: informe o endereço onde o serviço foi executado (local da prestação).',
        );
      }
    }
  }

  if (issnetRtc) {
    if (String(payload.versaoEsquema || '') !== 'RTC007') {
      warnings.push(
        'Emissão ISSNET Ribeirão: versaoEsquema esperado RTC007 (layout municipal com IBS/CBS).',
      );
    }
  }

  return { errors, warnings };
};

/**
 * @param {{ errors: string[], warnings: string[] }} result
 */
export const assertNfseEmitPreflightOrThrow = (result) => {
  if (!result.errors.length) return;
  throw badRequest(result.errors[0], { nfsePreflight: result });
};
