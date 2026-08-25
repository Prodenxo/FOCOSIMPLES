/**
 * Endereço do emitente NF-e a partir do snapshot de certificado / cadastro MEI.
 */

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * @param {Record<string, unknown> | null | undefined} snap
 * @returns {Record<string, string> | null}
 */
export const mapNfeEmitenteEnderecoFromCertificateSnapshot = (snap) => {
  if (!snap || typeof snap !== 'object') return null;

  const uf = String(snap.uf || snap.estado || '').trim().toUpperCase().slice(0, 2);
  if (uf.length !== 2) return null;

  const tipo = String(snap.tipo_logradouro || snap.tipoLogradouro || '').trim();
  const log = String(snap.logradouro || '').trim();
  let logradouro = log;
  if (tipo && log && !log.toLowerCase().startsWith(tipo.toLowerCase())) {
    logradouro = `${tipo} ${log}`.trim();
  }

  return {
    logradouro,
    numero: String(snap.numero || '').trim() || 'S/N',
    codigoCidade: onlyDigits(snap.ibge_municipio ?? snap.codigoCidade, 7),
    cep: onlyDigits(snap.cep, 8),
    ...(String(snap.complemento || '').trim() ? { complemento: String(snap.complemento).trim() } : {}),
    bairro: String(snap.bairro || '').trim(),
    estado: uf,
    descricaoCidade: String(snap.cidade || snap.descricaoCidade || '').trim(),
  };
};

/**
 * @param {Record<string, unknown>} emitente
 * @returns {boolean}
 */
export const emitenteHasNfeTaxUf = (emitente) => {
  const endereco = emitente?.endereco;
  if (!endereco || typeof endereco !== 'object') return false;
  const uf = String(endereco.estado || endereco.uf || emitente.uf || '').trim().toUpperCase();
  return uf.length === 2;
};
