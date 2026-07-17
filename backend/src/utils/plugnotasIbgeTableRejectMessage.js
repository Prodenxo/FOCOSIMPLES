/**
 * Heurística espelhada de `isPlugnotasEmpresaIbgeCidadeMessage` em
 * `frontend/src/utils/nfseNacionalPlugnotasErrorHints.ts` (CID-L1 / TIBGE-L1).
 * Manter alinhado quando alterar detecção no cliente (FR-TIBGE-OBS-01 / NFR-TIBGE-03).
 *
 * @param {string} message — texto de erro Plugnotas/BFF (corpo ou mensagem agregada)
 * @returns {boolean}
 */
export function normalizeForMatchPlugnotasIbge(message) {
  return String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Indício de rejeição por tabela IBGE / código município no emissor (400 típico).
 * @param {string} message
 * @returns {boolean}
 */
export function isPlugnotasIbgeTableRejectMessage(message) {
  const m = normalizeForMatchPlugnotasIbge(message);
  if (!m.trim()) return false;

  const hasEnderecoCodigoCidade =
    m.includes('endereco.codigocidade') ||
    m.includes('fields.endereco.codigocidade');

  const hasTabelaIbge =
    m.includes('ibge') &&
    m.includes('tabela') &&
    (m.includes('cidades') ||
      m.includes('cidade') ||
      m.includes('municipio') ||
      m.includes('municipios'));

  const hasCodigoIbgeMunicipio =
    m.includes('ibge') &&
    (m.includes('codigocidade') ||
      m.includes('codigo ibge') ||
      m.includes('codigo do municipio') ||
      m.includes('codigoibgecidade'));

  return hasEnderecoCodigoCidade || hasTabelaIbge || hasCodigoIbgeMunicipio;
}
