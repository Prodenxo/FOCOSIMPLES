/**
 * Utilitários de formatação e helpers para o módulo fiscal (Notas).
 * Apenas JavaScript, sem dependências externas além de Lucide.
 */

export function formatCurrencyBRL(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatDateBR(value) {
  if (!value) return '';
  const str = String(value);
  // ISO yyyy-mm-dd or full ISO
  const datePart = str.includes('T') ? str.slice(0, 10) : str.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
  if (!m) return str;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatDateTimeBR(value) {
  if (!value) return '';
  const str = String(value);
  const datePart = str.slice(0, 10);
  const timePart = str.slice(11, 16);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
  if (!m) return str;
  const date = `${m[3]}/${m[2]}/${m[1]}`;
  return timePart ? `${date} ${timePart}` : date;
}

/** Converte "YYYY-MM" para label legível: "Janeiro/2026". */
export function formatCompetencia(value) {
  const str = String(value || '');
  const m = /^(\d{4})-(\d{2})/.exec(str);
  if (!m) return str;
  const year = m[1];
  const monthNum = Number(m[2]);
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const label = months[monthNum - 1] || '';
  return `${label}/${year}`;
}

/** Converte competência (YYYY-MM ou YYYYMM) para periodoApuracao (YYYYMM). */
export function competenciaToPeriodoApuracao(comp) {
  const text = String(comp || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    return text.replace(/-/g, '');
  }
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const month = digits.slice(4, 6);
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return null;
  return digits;
}

/** Resumo curto da competência: "Jan/2026". */
export function formatCompetenciaShort(value) {
  const str = String(value || '');
  const m = /^(\d{4})-(\d{2})/.exec(str);
  if (!m) return str;
  const year = m[1];
  const monthNum = Number(m[2]);
  const short = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${short[monthNum - 1] || ''}/${year}`;
}

/** Traduz status DAS. */
export function describeDasStatus(status) {
  switch (status) {
    case 'pago': return 'Pago';
    case 'a_pagar': return 'A pagar';
    case 'sem_debito': return 'Sem débito';
    case 'a_declarar': return 'A declarar';
    case 'erro': return 'Falha na consulta';
    case 'indisponivel': return 'Indisponível';
    default: return 'Sem guia';
  }
}

export function dasStatusTone(status) {
  switch (status) {
    case 'pago': return 'success';
    case 'a_pagar': return 'warning';
    case 'sem_debito': return 'muted';
    case 'a_declarar': return 'info';
    case 'erro': return 'danger';
    default: return 'muted';
  }
}

/** Traduz tipo de documento fiscal. */
export function describeDocumentType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'nfse' || t === 'nfs-e' || t === 'nfs_e') return 'NFS-e';
  if (t === 'nfe' || t === 'nf-e' || t === 'nf_e') return 'NF-e';
  if (t === 'nfce' || t === 'nfc-e' || t === 'nfc_e') return 'NFC-e';
  return type || 'Documento';
}

/** Estado consolidado do certificado. */
export function describeCertificateState(state) {
  switch (state) {
    case 'configured': return { label: 'Configurado', tone: 'success' };
    case 'valid': return { label: 'Válido', tone: 'success' };
    case 'expired': return { label: 'Expirado', tone: 'danger' };
    case 'absent': return { label: 'Ausente', tone: 'muted' };
    case 'unavailable': return { label: 'Indisponível', tone: 'warning' };
    case 'loading': return { label: 'Verificando…', tone: 'muted' };
    default: return { label: 'Verificando…', tone: 'muted' };
  }
}

/** Determina estado do certificado baseado nos dados reais. */
export function resolveCertificateState({ loading, error, hasUserCertificate, hasEnvCertificate, validTo }) {
  if (loading) return 'loading';
  if (error) return 'unavailable';
  if (!hasUserCertificate && !hasEnvCertificate) return 'absent';
  if (validTo) {
    const expiry = new Date(validTo);
    if (Number.isFinite(expiry.getTime()) && expiry.getTime() < Date.now()) {
      return 'expired';
    }
    return 'valid';
  }
  return 'configured';
}

/** Baixa blob retornando o nome amigável. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
