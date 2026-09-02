/**
 * Contrato API: prefill do prestador NFSe a partir de user_mei_certificates.
 * Fonte: docs/contracts/nfse-prestador-from-mei-certificate.md (Story 2.0)
 */

export interface NfsePrestadorEnderecoPrefill {
  logradouro: string | null;
  numero: string | null;
  codigoCidade: string | null;
  cep: string | null;
  complemento: string | null;
  bairro: string | null;
  estado: string | null;
  descricaoCidade: string | null;
}

/**
 * Resposta do BFF para auto-preencher {@link EmitirNfseInput} (apenas campos do prestador).
 * Sem segredos (PFX, senhas).
 */
export interface NfsePrestadorPrefillDto {
  prestadorCpfCnpj: string | null;
  prestadorRazaoSocial: string | null;
  prestadorEmail: string | null;
  prestadorInscricaoMunicipal: string | null;
  prestadorEndereco: NfsePrestadorEnderecoPrefill | null;
  /** PK da linha origem; opcional para suporte/auditoria */
  sourceRowId?: string | null;
}

/**
 * Converte EmpresaFiscalData (dados live do PlugNotas após cadastro) em
 * NfsePrestadorPrefillDto. Usado como fonte secundária de prefill quando
 * o registro local em user_mei_certificates não tem os campos preenchidos.
 */
export function empresaFiscalToPrestadorPrefill(empresa: any): NfsePrestadorPrefillDto {
  if (!empresa) {
    return {
      prestadorCpfCnpj: null,
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: null,
      sourceRowId: null,
    };
  }
  const endereco = empresa?.endereco || null;
  return {
    prestadorCpfCnpj: empresa?.cpfCnpj || null,
    prestadorRazaoSocial: empresa?.razaoSocial || empresa?.nomeFantasia || null,
    prestadorEmail: empresa?.email || null,
    prestadorInscricaoMunicipal: empresa?.inscricaoMunicipal || null,
    prestadorEndereco: endereco
      ? {
          logradouro: endereco?.logradouro ?? null,
          numero: endereco?.numero ?? null,
          codigoCidade: endereco?.codigoCidade != null ? String(endereco.codigoCidade) : null,
          cep: endereco?.cep ?? null,
          complemento: endereco?.complemento ?? null,
          bairro: endereco?.bairro ?? null,
          estado: endereco?.estado ?? null,
          descricaoCidade: endereco?.descricaoCidade ?? null,
        }
      : null,
    sourceRowId: null,
  };
}
