/**
 * Bootstrap de company_fiscal_profiles a partir do certificado A1 (CNPJ + CRT + UF).
 * Evita bloqueio na configuração fiscal quando o cliente já emite mas o perfil ainda não foi criado.
 */
import { query as defaultQuery } from '../../config/pg.js';
import { FISCAL_PROFILE_STATUS } from '../../fiscal-engine/fiscal-configuration/constants.js';
import {
  getCompanyFiscalProfile as defaultGetCompanyFiscalProfile,
  saveCompanyFiscalProfile as defaultSaveCompanyFiscalProfile,
} from '../../fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';

let queryRef = defaultQuery;
let getProfileRef = defaultGetCompanyFiscalProfile;
let saveProfileRef = defaultSaveCompanyFiscalProfile;

/** @internal testes */
export const __setAccountantFiscalBootstrapDepsForTests = (deps = {}) => {
  queryRef = deps.query ?? defaultQuery;
  getProfileRef = deps.getCompanyFiscalProfile ?? defaultGetCompanyFiscalProfile;
  saveProfileRef = deps.saveCompanyFiscalProfile ?? defaultSaveCompanyFiscalProfile;
};

/** @internal testes */
export const __resetAccountantFiscalBootstrapDepsForTests = () => {
  queryRef = defaultQuery;
  getProfileRef = defaultGetCompanyFiscalProfile;
  saveProfileRef = defaultSaveCompanyFiscalProfile;
};

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const parseCrtValue = (value, optanteSimples) => {
  const normalized = String(value ?? '').trim();
  if (normalized) {
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= 4) return asNumber;
    if (/simples/i.test(normalized)) return 1;
  }
  if (optanteSimples) return 1;
  return null;
};

const resolveTaxRegime = (crt, optanteSimples) => {
  if (crt === 1 || optanteSimples) return 'SIMPLES_NACIONAL';
  if (crt === 3) return 'REGIME_NORMAL';
  return null;
};

const resolveIssuerUf = (value) => {
  const uf = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
};

/**
 * Emissores elegíveis do tenant com dados mínimos do certificado A1.
 * @param {string} tenantId
 */
export const listCertificateEmittersForTenant = async (tenantId) => {
  const normalizedTenant = String(tenantId || '').trim();
  if (!normalizedTenant) return [];

  const result = await queryRef(
    `SELECT DISTINCT ON (regexp_replace(umc.cert_document, '\\D', '', 'g'))
      regexp_replace(umc.cert_document, '\\D', '', 'g') AS establishment_id,
      umc.regime_tributario AS crt,
      umc.optante_simples_nacional,
      umc.uf,
      umc.ibge_municipio,
      umc.razao_social,
      umc.nome_fantasia,
      umc.updated_at
    FROM role_x_user_x_empresa rx
    INNER JOIN empresas e ON e.id = rx.empresas_id
    INNER JOIN user_mei_certificates umc ON umc.user_id = rx.user_id
    WHERE rx.empresas_id = $1::uuid
      AND rx.mei = true
      AND COALESCE(rx.status, true) = true
      AND COALESCE(e.max_mei, 0) > 0
      AND e.status = 'active'
      AND COALESCE(umc.status, 'VALIDO') = 'VALIDO'
      AND umc.cert_document IS NOT NULL
      AND length(regexp_replace(umc.cert_document, '\\D', '', 'g')) = 14
      AND (
        NULLIF(trim(umc.regime_tributario), '') IS NOT NULL
        OR COALESCE(umc.optante_simples_nacional, false) = true
      )
    ORDER BY regexp_replace(umc.cert_document, '\\D', '', 'g'), umc.updated_at DESC NULLS LAST`,
    [normalizedTenant],
  );

  return (result.rows ?? [])
    .map((row) => {
      const establishmentId = digitsOnly(row.establishment_id);
      const crt = parseCrtValue(row.crt, row.optante_simples_nacional);
      if (!establishmentId || !crt) return null;
      return {
        establishmentId,
        crt,
        taxRegime: resolveTaxRegime(crt, row.optante_simples_nacional),
        issuerUf: resolveIssuerUf(row.uf),
        municipalityCode: digitsOnly(row.ibge_municipio) || null,
        tradeName: String(row.nome_fantasia ?? row.razao_social ?? '').trim() || null,
      };
    })
    .filter(Boolean);
};

/**
 * Cria perfis fiscais DRAFT ausentes a partir do certificado A1.
 * Não sobrescreve perfis já existentes.
 * @param {string} tenantId
 * @returns {Promise<number>} quantidade de perfis criados
 */
export const bootstrapCompanyFiscalProfilesFromCertificates = async (tenantId) => {
  const emitters = await listCertificateEmittersForTenant(tenantId);
  if (!emitters.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;

  for (const emitter of emitters) {
    const existing = await getProfileRef({
      tenantId,
      establishmentId: emitter.establishmentId,
    });
    if (existing) continue;

    await saveProfileRef({
      tenantId,
      companyId: tenantId,
      establishmentId: emitter.establishmentId,
      crt: emitter.crt,
      taxRegime: emitter.taxRegime,
      issuerUf: emitter.issuerUf,
      municipalityCode: emitter.municipalityCode,
      validFrom: today,
      status: FISCAL_PROFILE_STATUS.DRAFT,
      configuredBy: null,
      configuredAt: new Date().toISOString(),
    });
    inserted += 1;
  }

  return inserted;
};
