import { apiClient, downloadToFile } from '../lib/apiClient';
import { mimeFromFilename, persistBinaryDownload } from '../lib/platformDownload';

export interface CreateMeiGuideInput {
  cnpj: string;
  periodoApuracao: string;
  contribuinte: {
    numero: string;
    tipo: number;
  };
}

export interface MeiGuideResponse {
  id: string;
  status: string;
  downloadUrl?: string | null;
  pdfBase64?: string | null;
  filename?: string | null;
}

export interface MeiPeriod {
  competencia: string;
  status: 'pago' | 'a_pagar' | 'erro' | 'indisponivel';
  guideId?: string | null;
  errorMessage?: string | null;
  /** Após dia 20 do mês seguinte à competência e ainda a_pagar. */
  vencida?: boolean;
  /** Ex.: 20/07/2026 */
  vencimento?: string | null;
  /** Valor do DAS (quando conhecido via Receita/cache). */
  valorTotal?: number | null;
  periodoApuracao?: string | null;
  numeroDocumento?: string | null;
  hasLocalPdf?: boolean;
}

/** Competências indisponíveis (antes da abertura MEI, futuro, etc.) não entram na lista da UI. */
export function filterMeiPeriodsForDisplay (periods: MeiPeriod[]): MeiPeriod[] {
  return periods.filter((period) => period.status !== 'indisponivel')
}

export interface MeiCertificateStatus {
  hasUserCertificate: boolean;
  hasEnvCertificate: boolean;
  documento?: string | null;
  certValidFrom?: string | null;
  certValidTo?: string | null;
  documentosAtivos?: {
    nfse: boolean;
    nfe: boolean;
    nfce: boolean;
  } | null;
}

export interface MeiValidationResult {
  valid: boolean;
  message?: string | null;
}

export interface ParcelamentoItem {
  numero?: string;
  dataPedido?: string;
  situacao?: string;
  dataSituacao?: string;
  modalidade?: string;
}

export type ParcelamentoParcelaSituacao = 'pago' | 'a_pagar' | 'liberada' | 'indisponivel';

export interface ParcelamentoParcelaOption {
  periodoApuracao: string;
  label: string;
  pago?: boolean;
  emAberto?: boolean;
  liberadaParaImpressao?: boolean;
  situacaoParcela?: ParcelamentoParcelaSituacao;
  valor?: number;
  dataArrecadacao?: string;
}

export interface ParcelamentoParcelasResponse {
  parcelas: ParcelamentoParcelaOption[];
}

export type ParcelamentoModalidadeStatus = {
  modalidade: string;
  idSistema?: string;
  idServico?: string;
  status: 'ok' | 'empty' | 'no_match' | 'error';
  erro?: string;
  itensBrutos?: number;
  itensNormalizados?: number;
};

export interface ParcelamentosResponse {
  parcelamentos: ParcelamentoItem[];
  modalidadesConsultadas?: number;
  resumoPorModalidade?: Record<string, number>;
  modalidadesStatus?: ParcelamentoModalidadeStatus[];
  /** Falha no termo Integra Contador (Apoiar) antes das consultas de modalidade. */
  termoAutorizacaoErro?: string;
}

export async function fetchParcelamentos(
  cnpj?: string,
  contribuinte?: { numero: string; tipo: number },
  options?: { scope?: 'mei' | 'all' }
): Promise<ParcelamentosResponse> {
  const params: Record<string, string> = {};
  if (cnpj) params.cnpj = cnpj;
  if (contribuinte) {
    params.contribuinteNumero = contribuinte.numero;
    params.contribuinteTipo = String(contribuinte.tipo);
  }
  if (options?.scope === 'mei') params.scope = 'mei';
  const query = new URLSearchParams(params);
  return await apiClient.get<ParcelamentosResponse>(`/mei-guide/parcelamentos?${query.toString()}`);
}

export async function createMeiGuide(input: CreateMeiGuideInput): Promise<MeiGuideResponse> {
  return await apiClient.post<MeiGuideResponse>('/mei-guide', input);
}

export function base64PdfToUint8Array(pdfBase64: string): Uint8Array {
  const normalized = String(pdfBase64 || '').replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function saveMeiGuidePdfFromBase64(
  pdfBase64: string,
  filename: string
): Promise<{ localUri: string; filename: string | null }> {
  const bytes = base64PdfToUint8Array(pdfBase64);
  const safeName = filename || 'guia-mei.pdf';
  const saved = await persistBinaryDownload(bytes, safeName, mimeFromFilename(safeName));
  return { localUri: saved.localUri, filename: saved.filename };
}

export async function regenerateMeiGuide(
  periodoApuracao: string,
  input: CreateMeiGuideInput
): Promise<MeiGuideResponse> {
  return await apiClient.post<MeiGuideResponse>(
    `/mei-guide/${encodeURIComponent(periodoApuracao)}/regenerate`,
    input
  );
}

export async function fetchMeiPeriods(
  cnpj: string,
  contribuinte?: { numero: string; tipo: number },
  options?: { refresh?: boolean },
): Promise<MeiPeriod[]> {
  const params: Record<string, string> = { cnpj };
  if (contribuinte) {
    params.contribuinteNumero = contribuinte.numero;
    params.contribuinteTipo = String(contribuinte.tipo);
  }
  if (options?.refresh) params.refresh = 'true';
  const query = new URLSearchParams(params);
  return await apiClient.get<MeiPeriod[]>(`/mei-guide/periods?${query.toString()}`);
}

export async function fetchMeiPeriodsByCnpj(
  cnpj: string,
  options?: { refresh?: boolean },
): Promise<MeiPeriod[]> {
  const params: Record<string, string> = { cnpj };
  if (options?.refresh) params.refresh = 'true';
  const query = new URLSearchParams(params);
  return await apiClient.get<MeiPeriod[]>(`/mei-guide/periods-by-cnpj?${query.toString()}`);
}

export async function downloadMeiGuide(
  cnpj: string,
  periodoApuracao: string,
  contribuinte: { numero: string; tipo: number },
  options?: { forceRefresh?: boolean }
) {
  const query = new URLSearchParams({
    cnpj,
    contribuinteNumero: contribuinte.numero,
    contribuinteTipo: String(contribuinte.tipo)
  });
  if (options?.forceRefresh) query.set('forceRefresh', 'true');
  const path = `/mei-guide/${encodeURIComponent(periodoApuracao)}/download?${query.toString()}`;
  return downloadToFile(path, `guia-mei-${periodoApuracao}.pdf`);
}

/** True se competência YYYY-MM / AAAAMM já passou do vencimento (dia 20 do mês seguinte). */
export function isMeiDasCompetenciaVencida(
  competencia: string,
  refDate: Date = new Date(),
): boolean {
  const text = String(competencia || '').trim();
  let year = 0;
  let month = 0;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    year = Number(text.slice(0, 4));
    month = Number(text.slice(5, 7));
  } else {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 6) {
      year = Number(digits.slice(0, 4));
      month = Number(digits.slice(4, 6));
    }
  }
  if (!year || month < 1 || month > 12) return false;
  let vencMonth = month + 1;
  let vencYear = year;
  if (vencMonth > 12) {
    vencMonth = 1;
    vencYear += 1;
  }
  const vencIso = `${vencYear}-${String(vencMonth).padStart(2, '0')}-20`;
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(refDate);
  return todayIso > vencIso;
}

export function formatMeiDasVencimento(competencia: string): string | null {
  const text = String(competencia || '').trim();
  let year = 0;
  let month = 0;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    year = Number(text.slice(0, 4));
    month = Number(text.slice(5, 7));
  } else {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 6) {
      year = Number(digits.slice(0, 4));
      month = Number(digits.slice(4, 6));
    }
  }
  if (!year || month < 1 || month > 12) return null;
  let vencMonth = month + 1;
  let vencYear = year;
  if (vencMonth > 12) {
    vencMonth = 1;
    vencYear += 1;
  }
  return `20/${String(vencMonth).padStart(2, '0')}/${vencYear}`;
}

export function isMeiPeriodVencida(period: MeiPeriod, refDate: Date = new Date()): boolean {
  if (period.vencida === true) return true;
  if (period.status !== 'a_pagar') return false;
  return isMeiDasCompetenciaVencida(period.competencia, refDate);
}

export async function fetchMeiCertificateStatus(): Promise<MeiCertificateStatus> {
  return apiClient.get<MeiCertificateStatus>('/mei-guide/certificate/status');
}

/** File for React Native: { uri, name, type? } from document picker. */
export async function uploadMeiCertificate(
  file: { uri: string; name: string; type?: string },
  password: string
): Promise<MeiCertificateStatus> {
  const formData = new FormData();
  const mimeType = file.type || 'application/x-pkcs12';

  // No browser (react-native-web), FormData precisa de Blob/File real.
  // O formato { uri, name, type } só funciona no React Native nativo.
  // Detecta web via `typeof window !== 'undefined'` + uri sendo blob:/data:/http(s).
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isWeb) {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const fileBlob = new File([blob], file.name, { type: mimeType });
    formData.append('certificate', fileBlob);
  } else {
    // @ts-expect-error React Native FormData accepts file object with uri, name, type
    formData.append('certificate', { uri: file.uri, name: file.name, type: mimeType });
  }
  formData.append('password', password);
  return await apiClient.postForm<MeiCertificateStatus>('/mei-guide/certificate', formData);
}

export async function removeMeiCertificate(): Promise<MeiCertificateStatus> {
  return await apiClient.delete<MeiCertificateStatus>('/mei-guide/certificate');
}

export async function validateMeiGuide(
  cnpj: string,
  periodoApuracao: string
): Promise<MeiValidationResult> {
  return await apiClient.post<MeiValidationResult>('/mei-guide/validate', {
    cnpj,
    periodoApuracao
  });
}

export async function fetchParcelamentoParcelas(
  numero: string,
  cnpj?: string,
  modalidade?: string,
  contribuinte?: { numero: string; tipo: number }
): Promise<ParcelamentoParcelasResponse> {
  const params: Record<string, string> = {};
  if (cnpj) params.cnpj = cnpj;
  if (modalidade) params.modalidade = modalidade;
  if (contribuinte) {
    params.contribuinteNumero = contribuinte.numero;
    params.contribuinteTipo = String(contribuinte.tipo);
  }
  const query = new URLSearchParams(params);
  return apiClient.get<ParcelamentoParcelasResponse>(
    `/mei-guide/parcelamentos/${encodeURIComponent(numero)}/parcelas?${query.toString()}`
  );
}

export async function downloadParcelamentoPdf(
  numero: string,
  cnpj?: string,
  modalidade?: string,
  contribuinte?: { numero: string; tipo: number },
  parcela?: string
): Promise<{ localUri: string; filename: string }> {
  const params: Record<string, string> = {};
  if (cnpj) params.cnpj = cnpj;
  if (modalidade) params.modalidade = modalidade;
  if (parcela) params.parcela = parcela;
  if (contribuinte) {
    params.contribuinteNumero = contribuinte.numero;
    params.contribuinteTipo = String(contribuinte.tipo);
  }
  const query = new URLSearchParams(params);
  const path = `/mei-guide/parcelamentos/${encodeURIComponent(numero)}/pdf?${query.toString()}`;
  const suffix = parcela ? `-${parcela}` : '';
  return downloadToFile(path, `parcelamento-${numero}${suffix}.pdf`);
}
