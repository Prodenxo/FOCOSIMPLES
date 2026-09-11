/**
 * Espelha permissões de emissão (NFSe / NFe / NFC-e) do certificado ou empresa.
 * @param {Record<string, unknown>|null|undefined} certStatus
 * @param {Record<string, unknown>|null|undefined} company
 */
export function resolveDocumentosPermitidos(certStatus, company) {
  const fromCert = certStatus?.documentosAtivos;
  const fromCompany = company?.documentosAtivos;

  const pick = (source) => {
    if (!source || typeof source !== 'object') return null;
    return {
      nfse: source.nfse !== false,
      nfe: source.nfe === true,
      nfce: source.nfce === true,
    };
  };

  const cert = pick(fromCert);
  const comp = pick(fromCompany);

  if (cert) return cert;
  if (comp) return comp;

  return {
    nfse: company?.nfse?.ativo !== false,
    nfe: company?.nfe?.ativo === true,
    nfce: company?.nfce?.ativo === true,
  };
}

/** @param {ReturnType<typeof resolveDocumentosPermitidos>} allowed */
export function allowedEmitDocumentTypes(allowed) {
  const types = [];
  if (allowed?.nfse) types.push('NFSE');
  if (allowed?.nfe) types.push('NFE');
  if (allowed?.nfce) types.push('NFCE');
  return types;
}
