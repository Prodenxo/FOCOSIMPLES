/**
 * Formulário NFSe — fluxo admin (`AdminUserDataScreen`). DTO 2.1 + certificado MEI (status).
 * Story 2.4: sem endereço placeholder; CNPJ com precedência documentada em Completion Notes da story.
 */
import type { EmitirNfseInput } from '../services/meiNotasService';
import type { NfsePrestadorPrefillDto } from './nfsePrestadorPrefillDto';
import { mergeNfsePrestadorPrefillIntoForm } from './meiNfseForms';
import { formatCpfCnpjInput } from './meiFormatters';

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export type PrestadorEnderecoForm = NonNullable<EmitirNfseInput['prestadorEndereco']>;

function trimOrEmpty(s?: string | null): string {
  return String(s ?? '').trim();
}

function formatCepDisplay(cep: string): string {
  const d = cep.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return cep.trim();
}

/**
 * Resumo read-only para o modal admin (observabilidade — Story 2.4 / QA). Sem dados inventados.
 */
export function formatPrestadorEnderecoResumoForAdmin(
  prestadorEndereco?: PrestadorEnderecoForm | null
): { summaryText: string; hasAddressData: boolean } {
  const e = prestadorEndereco ?? {};
  const log = trimOrEmpty(e.logradouro);
  const num = trimOrEmpty(e.numero);
  const comp = trimOrEmpty(e.complemento);
  const bairro = trimOrEmpty(e.bairro);
  const cidade = trimOrEmpty(e.descricaoCidade);
  const uf = trimOrEmpty(e.estado).toUpperCase();
  const ibge = trimOrEmpty(e.codigoCidade);
  const cepRaw = trimOrEmpty(e.cep);

  const parts: string[] = [];
  const main = [log, num].filter(Boolean).join(', ');
  let line1 = '';
  if (main && comp) line1 = `${main} — ${comp}`;
  else if (main) line1 = main;
  else if (comp) line1 = comp;
  if (line1) parts.push(line1);

  const cidadeUf =
    cidade && uf ? `${cidade} — ${uf}` : cidade || uf || '';
  const line2 = [bairro, cidadeUf].filter(Boolean).join(' • ');
  if (line2) parts.push(line2);

  const meta: string[] = [];
  if (ibge) meta.push(`IBGE ${ibge}`);
  if (cepRaw) meta.push(`CEP ${formatCepDisplay(cepRaw)}`);
  if (meta.length) parts.push(meta.join(' • '));

  const hasAddressData = parts.length > 0;
  return {
    hasAddressData,
    summaryText: hasAddressData ? parts.join('\n') : '',
  };
}

export function emptyAdminNfseEmitirForm(): EmitirNfseInput {
  return {
    prestadorCpfCnpj: '',
    prestadorEndereco: {
      logradouro: '',
      numero: '',
      codigoCidade: '',
      cep: '',
      complemento: '',
      bairro: '',
      estado: '',
      descricaoCidade: '',
    },
    tomadorCpfCnpj: '',
    tomadorRazaoSocial: '',
    tomadorEmail: '',
    servico: { codigo: '', discriminacao: '', cnae: '', aliquota: '', valorServico: '' },
  };
}

/**
 * CNPJ: se o DTO (2.1) trouxer 14 dígitos, prevalece sobre `documento` do certificado;
 * se o DTO não trouxer CNPJ válido, usa-se o documento do certificado (status MEI), quando houver 14 dígitos.
 */
export function applyAdminPrestadorPrefill(
  prefill: NfsePrestadorPrefillDto,
  certDocumento?: string | null
): EmitirNfseInput {
  const base = emptyAdminNfseEmitirForm();
  const merged = mergeNfsePrestadorPrefillIntoForm(base, prefill, { onlyFillEmpty: true });
  const dtoDigits = normalizeDoc(merged.prestadorCpfCnpj || '').slice(0, 14);
  const certDigits = certDocumento ? normalizeDoc(certDocumento).slice(0, 14) : '';

  if (dtoDigits.length === 14) {
    return merged;
  }
  if (certDigits.length === 14) {
    return {
      ...merged,
      prestadorCpfCnpj: formatCpfCnpjInput(certDigits),
    };
  }
  return merged;
}
