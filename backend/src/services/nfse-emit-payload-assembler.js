/**
 * Monta o payload NFS-e exatamente como enviado ao PlugNotas (pós-enrich, pré-RPS).
 * Usado pelo fluxo de emissão e pelo script CLI de debug de obra.
 */

import { enrichNfseIssInEmitPayload } from './nfse-iss-defaults.js';
import {
  enrichNfseCidadePrestacaoFromObra,
  enrichNfseObraOnEmitPayload,
  sanitizeCidadePrestacaoForIssnetRtc,
} from './nfse-obra-defaults.js';
import { enrichNfseReformaCabecalhoInEmitPayload } from './nfse-reforma-defaults.js';

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
  let emitPayload = { ...basePayload };

  if (prep.issnetOnline30 && prep.applyIss !== false) {
    emitPayload = enrichNfseIssInEmitPayload(emitPayload, {
      nfseNacional: prep.nfseNacional === true,
      simplesNacional: prep.simplesNacional !== false,
      issnetOnline30: true,
    });
  }

  emitPayload = enrichNfseCidadePrestacaoFromObra(emitPayload, {
    ...(prep.obraContext ?? {}),
    issnetOnline30: prep.issnetOnline30 === true,
  });
  emitPayload = enrichNfseObraOnEmitPayload(emitPayload, {
    ...(prep.obraContext ?? {}),
    issnetOnline30: prep.issnetOnline30 === true,
  });
  emitPayload = enrichNfseReformaCabecalhoInEmitPayload(emitPayload, {
    simplesNacional: prep.simplesNacional !== false,
    nfseNacional: prep.nfseNacional === true,
    codigoIbge: prep.codigoIbge,
  });

  if (prep.issnetOnline30) {
    emitPayload = sanitizeCidadePrestacaoForIssnetRtc(emitPayload);
  }

  return emitPayload;
};
