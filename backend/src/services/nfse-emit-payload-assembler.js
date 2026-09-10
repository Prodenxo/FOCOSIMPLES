/**
 * Monta o payload NFS-e exatamente como enviado ao PlugNotas (pós-enrich, pré-RPS).
 * Usado pelo fluxo de emissão e pelo script CLI de debug de obra.
 */

import { enrichNfseIssInEmitPayload } from './nfse-iss-defaults.js';
import {
  enrichNfseCidadePrestacaoFromObra,
  enrichNfseObraOnEmitPayload,
  stripCidadePrestacaoForIssnetRtcObra,
} from './nfse-obra-defaults.js';
import {
  enrichNfseReformaCabecalhoInEmitPayload,
  readCodigoIbgeFromEmpresa,
  requiresIssnetRtcEmitSchema,
  stripIncompleteServicoIbscbsFromEmitPayload,
} from './nfse-reforma-defaults.js';

/**
 * @param {Record<string, unknown>} basePayload
 * @param {{
 *   obraContext?: { servicosInput?: Array<Record<string, unknown>>, emitInput?: Record<string, unknown>|null, tomadorEndereco?: Record<string, unknown>|null },
 *   simplesNacional?: boolean,
 *   nfseNacional?: boolean,
 *   codigoIbge?: string,
 *   issnetOnline30?: boolean,
 * }} [prep]
 * @returns {Record<string, unknown>}
 */
export const assembleNfsePlugnotasEmitPayload = (basePayload, prep = {}) => {
  let emitPayload = stripIncompleteServicoIbscbsFromEmitPayload({ ...basePayload });

  const codigoIbge = String(
    prep.codigoIbge
    ?? readCodigoIbgeFromEmpresa({ endereco: emitPayload?.prestador?.endereco })
    ?? emitPayload?.prestador?.endereco?.codigoCidade
    ?? '',
  ).replace(/\D/g, '').slice(0, 7);
  const issnetOnline30 = prep.issnetOnline30 === true || requiresIssnetRtcEmitSchema(codigoIbge);

  if (prep.applyIss !== false) {
    emitPayload = enrichNfseIssInEmitPayload(emitPayload, {
      nfseNacional: prep.nfseNacional === true,
      simplesNacional: prep.simplesNacional !== false,
      issnetOnline30,
    });
  }

  emitPayload = enrichNfseObraOnEmitPayload(emitPayload, {
    ...(prep.obraContext ?? {}),
    issnetOnline30,
  });
  emitPayload = enrichNfseCidadePrestacaoFromObra(emitPayload, {
    ...(prep.obraContext ?? {}),
    issnetOnline30,
  });
  emitPayload = enrichNfseReformaCabecalhoInEmitPayload(emitPayload, {
    simplesNacional: prep.simplesNacional !== false,
    nfseNacional: prep.nfseNacional === true,
    codigoIbge,
  });

  if (issnetOnline30) {
    emitPayload = stripCidadePrestacaoForIssnetRtcObra(emitPayload);
  } else {
    emitPayload = stripIncompleteServicoIbscbsFromEmitPayload(emitPayload);
  }

  return emitPayload;
};
