import type { CnpjLookupResult, EmpresaFullData } from '../services/empresaService'

export function mapCnpjLookupToEmpresa (
  data: CnpjLookupResult,
  prev: EmpresaFullData = {},
): EmpresaFullData {
  const telefoneStr = data.telefone
    ? `${data.telefone.ddd || ''}${data.telefone.numero || ''}`
    : ''
  return {
    ...prev,
    cnpj: data.cpfCnpj,
    empresa: data.razaoSocial || prev.empresa || '',
    razao_social: data.razaoSocial || prev.razao_social || '',
    nome_fantasia: data.nomeFantasia || prev.nome_fantasia || '',
    inscricao_estadual: data.inscricaoEstadual || prev.inscricao_estadual || '',
    logradouro: data.endereco?.logradouro || prev.logradouro || '',
    numero: data.endereco?.numero || prev.numero || '',
    complemento: data.endereco?.complemento || prev.complemento || '',
    bairro: data.endereco?.bairro || prev.bairro || '',
    cidade: data.endereco?.descricaoCidade || prev.cidade || '',
    estado: data.endereco?.estado || prev.estado || '',
    cep: data.endereco?.cep || prev.cep || '',
    telefone: telefoneStr || prev.telefone || '',
    email: data.email || prev.email || '',
  }
}
