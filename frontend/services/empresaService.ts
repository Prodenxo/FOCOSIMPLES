import { apiClient } from '../lib/apiClient';
import { isValidCnpjDigits } from '../lib/validateCnpj';
import type { CnpjLookupData } from './meiNotasService';

export interface EmpresaFullData {
  id?: string;
  empresa?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  regime_tributario?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
}

export interface EmpresaOption {
  id: string;
  empresa: string;
  nome_fantasia?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
  product_line?: string | null;
}

export interface EmpresaLimitsPayload {
  empresa: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
}

export interface EmpresaUpdatePayload {
  empresa?: string;
  max_mei?: number | null;
  max_usuarios_nao_mei?: number | null;
}

export async function listEmpresas(): Promise<EmpresaOption[]> {
  const res = await apiClient.get<{ empresas?: EmpresaOption[] }>('/users/empresas');
  return res?.empresas ?? [];
}

export async function getEmpresa(): Promise<EmpresaFullData | null> {
  try {
    const res = await apiClient.get<{ empresa?: EmpresaFullData }>('/users/empresas/current');
    return res?.empresa ?? null;
  } catch {
    return null;
  }
}

export async function getEmpresaById(empresaId: string): Promise<EmpresaFullData | null> {
  try {
    const res = await apiClient.get<{ empresa?: EmpresaFullData }>(`/users/empresas/${encodeURIComponent(empresaId)}`);
    return res?.empresa ?? null;
  } catch {
    return null;
  }
}

export async function createEmpresa(input: EmpresaFullData): Promise<EmpresaFullData> {
  const res = await apiClient.post<{ empresa: EmpresaFullData }>('/users/empresas', input);
  if (!res?.empresa) throw new Error('Resposta inválida ao criar empresa');
  return res.empresa;
}

export async function updateEmpresa(empresaId: string, input: EmpresaFullData): Promise<EmpresaFullData> {
  const res = await apiClient.put<{ empresa: EmpresaFullData }>(
    `/users/empresas/${encodeURIComponent(empresaId)}`,
    input
  );
  if (!res?.empresa) throw new Error('Resposta inválida ao atualizar empresa');
  return res.empresa;
}

export async function deleteEmpresa(empresaId: string): Promise<void> {
  await apiClient.delete(`/users/empresas/${encodeURIComponent(empresaId)}`);
}

export interface CnpjLookupResult {
  cpfCnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  email: string | null;
  telefone: { ddd: string; numero: string } | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    codigoCidade: string | null;
    descricaoCidade: string | null;
    estado: string | null;
    cep: string | null;
  };
  situacaoCadastral?: string | null;
  porte?: string | null;
}

const shouldFallbackCnpjLookup = (error: unknown) => {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes('not authenticated') || msg.includes('não autenticado')) return false;
  if (msg.includes('inválido') || msg.includes('14 dígitos')) return false;
  if (msg.includes('não encontrado')) return false;
  return true;
};

const fromClientCnpjLookup = (data: CnpjLookupData): CnpjLookupResult => ({
  cpfCnpj: data.cpfCnpj,
  razaoSocial: data.razaoSocial,
  nomeFantasia: data.nomeFantasia,
  email: data.email,
  telefone: data.telefone,
  inscricaoMunicipal: data.inscricaoMunicipal,
  inscricaoEstadual: data.inscricaoEstadual,
  endereco: data.endereco,
  situacaoCadastral: data.situacaoCadastral,
  porte: data.porte,
  opcaoSimples: data.opcaoSimples,
});

/** Consulta dados cadastrais (PlugNotas + BrasilAPI no backend; fallback direto BrasilAPI no dispositivo). */
export async function lookupEmpresaCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
  if (!isValidCnpjDigits(digits)) {
    throw new Error('CNPJ inválido. Verifique os dígitos informados.');
  }

  try {
    return await apiClient.get<CnpjLookupResult>(`/users/empresas/cnpj-lookup/${digits}`);
  } catch (backendError) {
    if (!shouldFallbackCnpjLookup(backendError)) throw backendError;
    const { lookupCnpj } = await import('./meiNotasService');
    const data = await lookupCnpj(digits);
    return fromClientCnpjLookup(data);
  }
}

export async function createEmpresaLimits(input: EmpresaLimitsPayload): Promise<EmpresaFullData> {
  const res = await apiClient.post<{ empresa: EmpresaFullData }>('/users/empresas', input);
  if (!res?.empresa) throw new Error('Resposta inválida ao criar empresa');
  return res.empresa;
}

export async function updateEmpresaLimits(
  empresaId: string,
  input: EmpresaUpdatePayload,
): Promise<EmpresaFullData> {
  const res = await apiClient.put<{ empresa: EmpresaFullData }>(
    `/users/empresas/${encodeURIComponent(empresaId)}`,
    input,
  );
  if (!res?.empresa) throw new Error('Resposta inválida ao atualizar empresa');
  return res.empresa;
}
