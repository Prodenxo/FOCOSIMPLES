/** Endereço do destinatário na NF-e (obrigatório na Plugnotas/SEFAZ). */

export interface NfeDestinatarioEnderecoForm {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoCidade: string;
  descricaoCidade: string;
  estado: string;
}

export interface NfeDestinatarioEnderecoInput {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  codigoCidade: string;
  descricaoCidade: string;
  estado: string;
  complemento?: string;
}

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export function getDefaultNfeDestinatarioEndereco(): NfeDestinatarioEnderecoForm {
  return {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    codigoCidade: '',
    descricaoCidade: '',
    estado: '',
  };
}

export function getDestinatarioEnderecoValidationMessage(
  endereco: NfeDestinatarioEnderecoForm,
  label = 'NF-e',
): string | null {
  const cep = normalizeDoc(endereco.cep);
  if (cep.length !== 8) {
    return `Informe o CEP do destinatário da ${label} (8 dígitos).`;
  }
  if (!String(endereco.logradouro ?? '').trim()) {
    return `Informe o logradouro do destinatário da ${label}.`;
  }
  if (!String(endereco.numero ?? '').trim()) {
    return `Informe o número do endereço do destinatário da ${label}.`;
  }
  if (!String(endereco.bairro ?? '').trim()) {
    return `Informe o bairro do destinatário da ${label}.`;
  }
  const ibge = normalizeDoc(endereco.codigoCidade);
  if (ibge.length !== 7) {
    return `Informe o código IBGE da cidade do destinatário da ${label} (7 dígitos).`;
  }
  if (!String(endereco.descricaoCidade ?? '').trim()) {
    return `Informe a cidade do destinatário da ${label}.`;
  }
  const uf = String(endereco.estado ?? '').trim().toUpperCase();
  if (uf.length !== 2) {
    return `Informe a UF do destinatário da ${label} (2 letras).`;
  }
  return null;
}

export function mapDestinatarioEnderecoToPayload(
  endereco: NfeDestinatarioEnderecoForm,
): NfeDestinatarioEnderecoInput {
  return {
    cep: normalizeDoc(endereco.cep).slice(0, 8),
    logradouro: String(endereco.logradouro ?? '').trim(),
    numero: String(endereco.numero ?? '').trim(),
    bairro: String(endereco.bairro ?? '').trim(),
    codigoCidade: normalizeDoc(endereco.codigoCidade).slice(0, 7),
    descricaoCidade: String(endereco.descricaoCidade ?? '').trim(),
    estado: String(endereco.estado ?? '').trim().toUpperCase().slice(0, 2),
    ...(String(endereco.complemento ?? '').trim()
      ? { complemento: String(endereco.complemento).trim() }
      : {}),
  };
}
