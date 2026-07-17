import { apiClient, downloadToFile } from '../lib/apiClient';
import { supabase } from '../lib/supabase';
import { handleFunctionError } from '../lib/user-management';
import type { NfsePrestadorPrefillDto } from '../lib/nfsePrestadorPrefillDto';
import type { EmitirNotaInput } from './meiNotasService';

export interface AdminTransaction {
  id: string;
  tipo: 'saída' | 'entrada' | 'saida';
  valor: number;
  classificacao: string;
  criado_em: string;
  user_id: string | null;
  status: string;
  data?: string | null;
  categoria?: string | number | null;
  obs?: string | null;
}

export interface AdminCategory {
  id: string;
  nome: string;
  tipo: string;
  user_id?: string | null;
}

export interface CategoryBudgetSummary {
  categorias_id: number;
  valor_orcado: number | null;
  valor_gasto: number;
  valor_recebido: number;
}

export interface CategoryBudgetYearly {
  categorias_id?: number;
  month?: string;
  valor_orcado?: number | null;
  valor_gasto?: number;
  valor_recebido?: number;
  [key: string]: unknown;
}

export interface AdminBalance {
  balance: number;
  totalEntradas: number;
  totalSaidas: number;
}

export interface AdminDasPendingItem {
  userId: string;
  displayName: string;
  email: string | null;
  empresaId: string | null;
  empresaName: string | null;
  competencia: string;
  cnpj: string;
  status: 'pago' | 'pendente' | 'erro';
  pdfBucket?: string | null;
  pdfPath: string | null;
  hasPdf: boolean;
  generatedAt: string | null;
  errorMessage?: string | null;
}

export interface AdminDasPendingSummary {
  competencia: string;
  totalClientes: number;
  pendentes: number;
  items: AdminDasPendingItem[];
}

export interface AdminDasStatusFilters {
  competencia?: string;
  status?: 'pago' | 'pendente' | 'erro';
  q?: string;
}

export interface AdminMeiCertificateStatus {
  hasUserCertificate: boolean;
  hasEnvCertificate: boolean;
  documento?: string | null;
  /** Data de validade do certificado (ISO 8601). Exibida na área admin quando disponível. */
  validade?: string | null;
  validUntil?: string | null;
  /** Alternativa à validade: intervalo de validade (API pode retornar um ou outro). */
  certValidFrom?: string | null;
  certValidTo?: string | null;
  documentosAtivos?: {
    nfse: boolean;
    nfe: boolean;
    nfce: boolean;
  } | null;
}

/** Espelho de ParcelamentoItem para uso admin (evita import de guidesMeiService se desejado). */
export interface AdminParcelamentoItem {
  numero?: string;
  dataPedido?: string;
  situacao?: string;
  dataSituacao?: string;
  modalidade?: string;
}

export interface AdminParcelamentosResponse {
  parcelamentos: AdminParcelamentoItem[];
  modalidadesConsultadas?: number;
  resumoPorModalidade?: Record<string, number>;
}

export interface AdminMeiPeriod {
  competencia: string;
  status: 'pago' | 'a_pagar' | 'erro';
  guideId?: string | null;
  errorMessage?: string | null;
  vencida?: boolean;
  vencimento?: string | null;
}

export interface AdminMeiWhatsappResult {
  sent: boolean;
  webhook?: { status?: number; body?: unknown };
}

export async function fetchAdminUserTransactions(userId: string): Promise<AdminTransaction[]> {
  const data = await apiClient.get<AdminTransaction[]>(`/admin/users/${encodeURIComponent(userId)}/transactions`);
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminUserCategories(
  userId: string,
  tipo?: 'entrada' | 'saida' | 'saída'
): Promise<AdminCategory[]> {
  const query = tipo ? `?type=${tipo === 'saída' ? 'saida' : tipo}` : '';
  const data = await apiClient.get<AdminCategory[]>(`/admin/users/${encodeURIComponent(userId)}/categories${query}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminUserBudgetSummary(
  userId: string,
  filters?: { year?: number; month?: number }
): Promise<CategoryBudgetSummary[]> {
  const params = new URLSearchParams();
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.month) params.set('month', String(filters.month));
  const query = params.toString();
  const data = await apiClient.get<CategoryBudgetSummary[]>(
    `/admin/users/${encodeURIComponent(userId)}/budgets/summary${query ? `?${query}` : ''}`
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminUserBudgetYearly(
  userId: string,
  year: number
): Promise<CategoryBudgetYearly[]> {
  const data = await apiClient.get<CategoryBudgetYearly[]>(
    `/admin/users/${encodeURIComponent(userId)}/budgets/yearly?year=${year}`
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminUserBalance(userId: string): Promise<AdminBalance> {
  return apiClient.get<AdminBalance>(`/admin/users/${encodeURIComponent(userId)}/balance`);
}

export async function fetchAdminDasPending(competencia?: string): Promise<AdminDasPendingSummary> {
  const params = new URLSearchParams();
  if (competencia) params.set('competencia', competencia);
  const path = `/admin/das/pending${params.toString() ? `?${params.toString()}` : ''}`;
  return apiClient.get<AdminDasPendingSummary>(path);
}

export async function fetchAdminDasStatus(filters?: AdminDasStatusFilters): Promise<AdminDasPendingSummary> {
  const params = new URLSearchParams();
  if (filters?.competencia) params.set('competencia', filters.competencia);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.q) params.set('q', filters.q);
  const path = `/admin/das/status${params.toString() ? `?${params.toString()}` : ''}`;
  return apiClient.get<AdminDasPendingSummary>(path);
}

export async function reprocessAdminDas(
  userId: string,
  competencia: string
): Promise<{ userId: string; competencia: string; status: string; pdfPath: string | null }> {
  return apiClient.post('/admin/das/reprocess', { userId, competencia });
}

export async function fetchAdminMeiCertificateStatus(userId: string): Promise<AdminMeiCertificateStatus> {
  return apiClient.get<AdminMeiCertificateStatus>(`/admin/mei-guide/${encodeURIComponent(userId)}/certificate/status`);
}

export type AdminMeiDocumentosAtivosInput = {
  nfse: boolean;
  nfe: boolean;
  nfce: boolean;
};

export async function patchAdminMeiDocumentosAtivos(
  userId: string,
  documentosAtivos: AdminMeiDocumentosAtivosInput,
): Promise<{ documentosAtivos: AdminMeiDocumentosAtivosInput }> {
  return apiClient.patch<{ documentosAtivos: AdminMeiDocumentosAtivosInput }>(
    `/admin/users/${encodeURIComponent(userId)}/mei-documentos-ativos`,
    { documentosAtivos },
  );
}

export async function fetchAdminMeiPeriods(userId: string, cnpj?: string): Promise<AdminMeiPeriod[]> {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  const query = params.toString();
  const data = await apiClient.get<AdminMeiPeriod[]>(
    `/admin/mei-guide/${encodeURIComponent(userId)}/periods${query ? `?${query}` : ''}`
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminMeiPeriodsByCnpj(userId: string, cnpj: string): Promise<AdminMeiPeriod[]> {
  const params = new URLSearchParams({ cnpj });
  const data = await apiClient.get<AdminMeiPeriod[]>(
    `/admin/mei-guide/${encodeURIComponent(userId)}/periods-by-cnpj?${params.toString()}`
  );
  return Array.isArray(data) ? data : [];
}

export async function downloadAdminMeiGuide(
  userId: string,
  periodoApuracao: string,
  cnpj?: string
): Promise<{ localUri: string; filename: string }> {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  const query = params.toString();
  const path = `/admin/mei-guide/${encodeURIComponent(userId)}/download/${encodeURIComponent(periodoApuracao)}${query ? `?${query}` : ''}`;
  return downloadToFile(path, `guia-mei-${periodoApuracao}.pdf`);
}

export async function sendAdminMeiGuideWhatsapp(
  userId: string,
  payload: { periodoApuracao: string; competencia?: string; cnpj?: string }
): Promise<AdminMeiWhatsappResult> {
  return apiClient.post<AdminMeiWhatsappResult>(`/admin/mei-guide/${encodeURIComponent(userId)}/send-whatsapp`, payload);
}

export interface AdminNotasListOptions {
  includeArchived?: boolean;
  documentType?: 'NFSE' | 'NFE' | 'NFCE' | 'CTE';
}

/** Nota fiscal (NF-e/NFSe) para exibição na área admin. Compatível com NfseRecord do meiNotasService. */
export interface AdminNfseRecord {
  id: string;
  user_id: string;
  document_type?: string | null;
  provider?: string | null;
  plugnotas_id?: string | null;
  protocol?: string | null;
  id_integracao?: string | null;
  status?: string | null;
  archived_at?: string | null;
  cnpj_prestador?: string | null;
  cnpj_tomador?: string | null;
  metadata_json?: Record<string, unknown> | null;
  payload_json?: Record<string, unknown> | unknown[] | null;
  response_json?: Record<string, unknown> | unknown[] | null;
  pdf_url?: string | null;
  xml_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAdminParcelamentos(
  userId: string,
  cnpj?: string
): Promise<AdminParcelamentosResponse> {
  const params = new URLSearchParams();
  if (cnpj?.trim()) params.set('cnpj', cnpj.trim());
  const query = params.toString();
  const data = await apiClient.get<AdminParcelamentosResponse>(
    `/admin/mei-guide/${encodeURIComponent(userId)}/parcelamentos${query ? `?${query}` : ''}`
  );
  return (
    data ?? {
      parcelamentos: [],
      modalidadesConsultadas: 0,
      resumoPorModalidade: {}
    }
  );
}

export async function fetchAdminNotas(
  userId: string,
  options?: AdminNotasListOptions
): Promise<AdminNfseRecord[]> {
  const params = new URLSearchParams();
  if (options?.includeArchived) params.set('includeArchived', 'true');
  if (options?.documentType) params.set('documentType', options.documentType);
  const query = params.toString();
  const data = await apiClient.get<AdminNfseRecord[]>(
    `/admin/users/${encodeURIComponent(userId)}/mei-notas${query ? `?${query}` : ''}`
  );
  return Array.isArray(data) ? data : [];
}

export interface DownloadAdminParcelamentoPdfOptions {
  cnpj?: string;
  modalidade?: string;
  contribuinteNumero?: string;
  contribuinteTipo?: string;
}

export async function downloadAdminParcelamentoPdf(
  userId: string,
  numero: string,
  options?: DownloadAdminParcelamentoPdfOptions
): Promise<{ localUri: string; filename: string }> {
  const params = new URLSearchParams();
  if (options?.cnpj?.trim()) params.set('cnpj', options.cnpj.trim());
  if (options?.modalidade?.trim()) params.set('modalidade', options.modalidade.trim());
  if (options?.contribuinteNumero?.trim()) params.set('contribuinteNumero', options.contribuinteNumero.trim());
  if (options?.contribuinteTipo !== undefined && options?.contribuinteTipo !== '') params.set('contribuinteTipo', String(options.contribuinteTipo));
  const query = params.toString();
  const path = `/admin/mei-guide/${encodeURIComponent(userId)}/parcelamentos/${encodeURIComponent(numero)}/pdf${query ? `?${query}` : ''}`;
  return downloadToFile(path, `parcelamento-${numero}.pdf`);
}

export async function emitirNotaAsAdmin(
  userId: string,
  payload: EmitirNotaInput
): Promise<AdminNfseRecord> {
  return apiClient.post<AdminNfseRecord>(
    `/admin/users/${encodeURIComponent(userId)}/mei-nfse/emitir`,
    payload
  );
}

/**
 * Prefill prestador NFSe para utilizador alvo (admin/superadmin). Edge `mei-prestador-prefill` + body.userId.
 */
export async function fetchAdminNfsePrestadorPrefill(userId: string): Promise<NfsePrestadorPrefillDto> {
  const { data, error } = await supabase.functions.invoke<{
    prefill?: NfsePrestadorPrefillDto;
    error?: string;
  }>('mei-prestador-prefill', { body: { userId } });
  if (error) await handleFunctionError(error, 'Não foi possível carregar dados do prestador (admin)');
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  return (
    data?.prefill ?? {
      prestadorCpfCnpj: null,
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: null,
      sourceRowId: null,
    }
  );
}
