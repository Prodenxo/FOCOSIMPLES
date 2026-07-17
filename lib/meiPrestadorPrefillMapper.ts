/**
 * Mapa linha user_mei_certificates → NfsePrestadorPrefillDto.
 * Manter alinhado com backend/supabase/functions/_shared/meiPrestadorPrefillMapper.ts
 * e com os testes Deno em meiPrestadorPrefillMapper_test.ts (Story 2.1).
 */

import type { NfsePrestadorPrefillDto, NfsePrestadorEnderecoPrefill } from './nfsePrestadorPrefillDto';

export type UserMeiCertificateRow = {
  id: string;
  cnpj: string | null;
  razao_social: string | null;
  email: string | null;
  inscricao_municipal: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  codigo_ibge: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
};

function strField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
}

/**
 * Normaliza linha PostgREST (esquema novo ou legado). Alinhado com Edge `_shared/meiPrestadorPrefillMapper.ts`.
 */
export function normalizeUserMeiCertificateDbRow(
  raw: Record<string, unknown> | null | undefined
): UserMeiCertificateRow | null {
  if (raw == null) return null;
  const id = raw.id;
  if (typeof id !== 'string') return null;
  return {
    id,
    cnpj: strField(raw.cnpj ?? raw.cert_document),
    razao_social: strField(raw.razao_social),
    email: strField(raw.email ?? raw.fiscal_email),
    inscricao_municipal: strField(raw.inscricao_municipal),
    logradouro: strField(raw.logradouro),
    numero: strField(raw.numero),
    complemento: strField(raw.complemento),
    bairro: strField(raw.bairro),
    codigo_ibge: strField(raw.codigo_ibge ?? raw.ibge_municipio),
    cep: strField(raw.cep),
    cidade: strField(raw.cidade),
    uf: strField(raw.uf),
  };
}

const onlyDigits = (value: string | null | undefined) =>
  value == null || value === '' ? null : value.replace(/\D/g, '') || null;

const normalizeCep = (value: string | null | undefined) => {
  const d = onlyDigits(value);
  return d && d.length <= 8 ? d.slice(0, 8) : d;
};

export function mapUserMeiCertificateRowToNfsePrestadorDto(
  row: UserMeiCertificateRow | null
): NfsePrestadorPrefillDto {
  if (!row) {
    return {
      prestadorCpfCnpj: null,
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: null,
      sourceRowId: null,
    };
  }

  const hasAnyAddress =
    row.logradouro ||
    row.numero ||
    row.codigo_ibge ||
    row.cep ||
    row.complemento ||
    row.bairro ||
    row.cidade ||
    row.uf;

  const endereco: NfsePrestadorEnderecoPrefill | null = hasAnyAddress
    ? {
        logradouro: row.logradouro,
        numero: row.numero,
        codigoCidade: row.codigo_ibge,
        cep: normalizeCep(row.cep),
        complemento: row.complemento,
        bairro: row.bairro,
        estado: row.uf ? row.uf.trim().toUpperCase().slice(0, 2) || null : null,
        descricaoCidade: row.cidade,
      }
    : null;

  return {
    prestadorCpfCnpj: onlyDigits(row.cnpj),
    prestadorRazaoSocial: row.razao_social,
    prestadorEmail: row.email,
    prestadorInscricaoMunicipal: row.inscricao_municipal,
    prestadorEndereco: endereco,
    sourceRowId: row.id,
  };
}
