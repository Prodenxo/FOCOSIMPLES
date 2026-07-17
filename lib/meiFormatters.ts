/**
 * Helpers de formatação para área Meu MEI (NFSe, status, datas).
 * Adaptado do site Meu-financeiro (GuidesMei.tsx).
 */

export function getNfseStatusKey(status?: string | null): string {
  const text = String(status || '').toLowerCase();
  if (!text) return 'aguardando';
  if (text.includes('cancelamento_pendente')) return 'cancelamento_pendente';
  if (text.includes('aguardando')) return 'aguardando';
  if (text.includes('concluido') || text.includes('concluida') || text.includes('autoriz')) return 'concluido';
  if (text.includes('process')) return 'processando';
  if (text.includes('rejeit')) return 'rejeitado';
  if (text.includes('cancel')) return 'cancelado';
  if (text.includes('interromp')) return 'interrompido';
  return text;
}

/** Status que devem ser reconsultados no emissor (sync automático / manual). */
export function notaFiscalStatusPrecisaSyncAutomatico(status?: string | null): boolean {
  const key = getNfseStatusKey(status);
  return key === 'aguardando' || key === 'processando' || key === 'cancelamento_pendente';
}

export function formatNfseStatus(status?: string | null): string {
  const key = getNfseStatusKey(status);
  if (key === 'aguardando') return 'Aguardando';
  if (key === 'concluido') return 'Concluída';
  if (key === 'processando') return 'Processando';
  if (key === 'rejeitado') return 'Rejeitada';
  if (key === 'cancelado') return 'Cancelada';
  if (key === 'cancelamento_pendente') return 'Cancelamento pendente';
  if (key === 'interrompido') return 'Interrompida';
  return status || 'Aguardando';
}

/** Cor sugerida para badge de status (React Native StyleSheet / theme). */
export function getNfseStatusBadgeColor(status?: string | null): string {
  const key = getNfseStatusKey(status);
  if (key === 'concluido') return '#059669';
  if (key === 'aguardando') return '#D97706';
  if (key === 'processando') return '#2563EB';
  if (key === 'cancelamento_pendente') return '#D97706';
  if (key === 'rejeitado' || key === 'cancelado' || key === 'interrompido') return '#DC2626';
  return '#6B7280';
}

/** Fundo do pill de status — contraste legível no tema claro e escuro. */
export function getNfseStatusBadgeBackground(status?: string | null): string {
  const key = getNfseStatusKey(status);
  if (key === 'concluido') return 'rgba(5, 150, 105, 0.2)';
  if (key === 'aguardando') return 'rgba(217, 119, 6, 0.2)';
  if (key === 'processando') return 'rgba(37, 99, 235, 0.2)';
  if (key === 'cancelamento_pendente') return 'rgba(217, 119, 6, 0.22)';
  if (key === 'rejeitado' || key === 'cancelado' || key === 'interrompido') return 'rgba(220, 38, 38, 0.18)';
  return 'rgba(107, 114, 128, 0.2)';
}

/** Usa `status` da linha ou tenta extrair do JSON do emissor (lista sem sync). */
export function resolveNfseDisplayStatus(record: {
  status?: string | null;
  response_json?: Record<string, unknown> | unknown[] | null;
} | null | undefined): string | null {
  if (record?.status?.trim()) return record.status;
  for (const row of asResponseRecords(record?.response_json)) {
    const message = String(row.message ?? row.mensagem ?? '').toLowerCase();
    if (message.includes('aguardando')) return 'aguardando';
    const candidate = row.status ?? row.situacao ?? row.situacaoNfse ?? row.mensagem;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

export function meiFiscalDocumentTypeShortLabel(documentType?: string | null): string {
  const key = String(documentType || 'NFSE').trim().toUpperCase();
  if (key === 'NFE') return 'NFe';
  if (key === 'NFCE') return 'NFC-e';
  if (key === 'NFSE') return 'NFSe';
  return key || 'NFSe';
}

function asResponseRecords(
  value?: Record<string, unknown> | unknown[] | null,
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  }
  if (value && typeof value === 'object') {
    return [value as Record<string, unknown>];
  }
  return [];
}

function parseEmbeddedPrefeituraErrors(text: string): string | null {
  const jsonStart = text.indexOf('[{');
  if (jsonStart < 0) return null;
  const slice = text.slice(jsonStart);
  try {
    const parsed = JSON.parse(slice) as Array<{
      Codigo?: string;
      Descricao?: string;
      codigo?: string;
      descricao?: string;
    }>;
    if (!Array.isArray(parsed)) return null;
    const lines = parsed
      .map((entry) => {
        const code = entry.Codigo || entry.codigo;
        const desc = entry.Descricao || entry.descricao;
        if (code && desc) return `${code}: ${desc}`;
        return desc || code || '';
      })
      .filter(Boolean);
    return lines.length ? lines.join('\n') : null;
  } catch {
    return null;
  }
}

function normalizeFailureText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseEmbeddedPrefeituraErrors(trimmed) || trimmed;
}

function pickMessageFromResponseRecord(record: Record<string, unknown>): string | null {
  const direct =
    normalizeFailureText(record.mensagem)
    || normalizeFailureText(record.message)
    || normalizeFailureText(record.error);
  if (direct) return direct;

  const retorno = record.retorno;
  if (retorno && typeof retorno === 'object') {
    const fromRetorno = normalizeFailureText(
      (retorno as Record<string, unknown>).mensagemRetorno,
    );
    if (fromRetorno) return fromRetorno;
  }

  return normalizeFailureText(record.mensagemRetorno);
}

const NFSE_REJECTION_RPS_DUPLICATE_RE =
  /E0014|dps já existe|dps ja existe|numeração repetida|numeracao repetida|conjunto de série,\s*número|conjunto de serie,\s*numero/i;

/**
 * Traduz rejeições conhecidas da NFS-e Nacional (ex.: E0014 = série/número RPS já usados).
 */
export function humanizeNfseRejectionMessage(raw: string | null | undefined): string | null {
  const text = normalizeFailureText(raw);
  if (!text) return null;
  if (!NFSE_REJECTION_RPS_DUPLICATE_RE.test(text)) return text;

  return (
    'Numeração repetida (série + número da nota): esta combinação já foi usada numa emissão anterior. '
    + 'Não é bloqueio por cliente nem por valor — pode emitir quantas notas quiser para a mesma pessoa, '
    + 'inclusive com valores iguais; basta emitir de novo que o sistema usa o próximo número automaticamente. '
    + `Detalhe da prefeitura: ${text}`
  );
}

/** Extrai mensagem de rejeição/interrupção retornada pelo emissor (PlugNotas / prefeitura). */
export function extractNfseFailureMessage(
  responseJson?: Record<string, unknown> | unknown[] | null,
  metadataJson?: Record<string, unknown> | null,
): string | null {
  for (const record of asResponseRecords(responseJson)) {
    const message = pickMessageFromResponseRecord(record);
    if (message) return humanizeNfseRejectionMessage(message);
  }

  if (metadataJson && typeof metadataJson === 'object') {
    const providerError = normalizeFailureText(metadataJson.providerError);
    if (providerError) return humanizeNfseRejectionMessage(providerError);

    const cancelamento = metadataJson.cancelamento;
    if (cancelamento && typeof cancelamento === 'object') {
      const cancelError = normalizeFailureText(
        (cancelamento as Record<string, unknown>).providerError,
      );
      if (cancelError) return humanizeNfseRejectionMessage(cancelError);
    }
  }

  return null;
}

export function notaFiscalExibeMotivoFalha(status?: string | null): boolean {
  const key = getNfseStatusKey(status);
  return key === 'rejeitado' || key === 'interrompido';
}

export function formatNfseFailureAlertTitle(status?: string | null): string {
  const key = getNfseStatusKey(status);
  if (key === 'interrompido') return 'Emissão interrompida';
  return 'Nota rejeitada';
}

/** Oculta rejeições E0014 (numeração repetida) da lista principal — ruído operacional. */
export function isHiddenNfseE0014RejectedRecord(
  record: {
    status?: string | null;
    document_type?: string | null;
    response_json?: unknown;
    payload_json?: unknown;
  } | null | undefined,
): boolean {
  if (!record) return false;
  const docType = String(record.document_type || 'NFSE').trim().toUpperCase();
  if (docType && docType !== 'NFSE') return false;
  if (getNfseStatusKey(record.status) !== 'rejeitado') return false;
  if (record.metadata_json?.nfseRejectionCode === 'E0014') return true;
  try {
    const text = JSON.stringify({
      response: record.response_json,
      payload: record.payload_json,
    }).toLowerCase();
    return NFSE_REJECTION_RPS_DUPLICATE_RE.test(text) || text.includes('e0014');
  } catch {
    return false;
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '---';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR');
}

export function formatDateTimeShort(value?: string | null): string {
  if (!value) return '---';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

function formatDoc(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * CPF/CNPJ enquanto o utilizador digita — alinhado a `MeiScreen` / NFSe.
 */
export function formatCpfCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  let formatted = '';
  for (let i = 0; i < digits.length; i += 1) {
    formatted += digits[i];
    if (digits.length <= 11) {
      if (i === 2 || i === 5) formatted += '.';
      if (i === 8) formatted += '-';
    } else {
      if (i === 1 || i === 4) formatted += '.';
      if (i === 7) formatted += '/';
      if (i === 11) formatted += '-';
    }
  }
  return formatted;
}

export function buildClienteCatalogLabel(item: { nome?: string | null; documento?: string | null; email?: string | null }): string {
  const parts = [item.nome || null, item.documento || null, item.email || null].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Cliente sem identificação';
}

export function buildProdutoCatalogLabel(item: { codigo?: string | null; cnae?: string | null; discriminacao?: string | null }): string {
  const parts = [item.codigo || null, item.cnae ? `CNAE ${item.cnae}` : null, item.discriminacao || null].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Serviço sem identificação';
}
