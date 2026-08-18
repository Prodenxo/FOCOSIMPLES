/**
 * Boundaries fiscais BPO — establishments canônicos e validação fail-closed.
 * Fonte canônica: company_fiscal_profiles (CompanyFiscalProfile).
 * empresas.cnpj NÃO é authority fiscal.
 */
import { listCompanyFiscalProfiles } from '../../fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import { findCatalogProdutoPorEmpresa } from '../mei-notas.service.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

let listProfilesRef = listCompanyFiscalProfiles;
let findProductRef = findCatalogProdutoPorEmpresa;

/** @internal testes */
export const __setAccountantFiscalBoundaryDepsForTests = (deps = {}) => {
  listProfilesRef = deps.listCompanyFiscalProfiles ?? listCompanyFiscalProfiles;
  findProductRef = deps.findCatalogProdutoPorEmpresa ?? findCatalogProdutoPorEmpresa;
};

/** @internal testes */
export const __resetAccountantFiscalBoundaryDepsForTests = () => {
  listProfilesRef = listCompanyFiscalProfiles;
  findProductRef = findCatalogProdutoPorEmpresa;
};

export const isAccountantScopedRequest = (req) => Boolean(
  String(req?.params?.empresaId ?? req?.requesterContext?.empresaId ?? '').trim(),
);

/**
 * Lista estabelecimentos fiscais explícitos (CNPJ) do tenant.
 * Exclui establishment_id = 'default'.
 */
export const listCanonicalEstablishmentsForTenant = async (tenantId) => {
  const profiles = await listProfilesRef(tenantId);
  const establishments = [];
  const seen = new Set();

  for (const profile of profiles || []) {
    const establishmentId = digitsOnly(
      profile.establishmentId ?? profile.establishment_id ?? '',
    );
    if (!establishmentId || establishmentId === 'default') continue;
    if (seen.has(establishmentId)) continue;
    seen.add(establishmentId);
    establishments.push({
      establishmentId,
      label: profile.tradeName ?? profile.label ?? establishmentId,
      issuerUf: profile.issuerUf ?? profile.issuer_uf ?? null,
      source: 'company_fiscal_profile',
    });
  }

  return establishments;
};

/**
 * Fail-closed: establishment deve existir em company_fiscal_profiles do tenant.
 */
export const assertEstablishmentBelongsToTenant = async (tenantId, establishmentId) => {
  const normalizedTenant = String(tenantId || '').trim();
  const normalizedEst = digitsOnly(establishmentId);
  if (!normalizedTenant || !normalizedEst) {
    throw badRequest('tenantId e establishmentId obrigatórios');
  }
  if (normalizedEst === 'default') {
    throw forbidden('Estabelecimento fiscal inválido', { code: 'FISCAL_ESTABLISHMENT_FORBIDDEN' });
  }

  const establishments = await listCanonicalEstablishmentsForTenant(normalizedTenant);
  const match = establishments.find((e) => e.establishmentId === normalizedEst);
  if (!match) {
    throw forbidden('Estabelecimento fiscal não pertence ao cliente informado', {
      code: 'FISCAL_ESTABLISHMENT_TENANT_FORBIDDEN',
    });
  }
  return match;
};

/**
 * Fail-closed: produto comercial deve pertencer ao tenant (empresa_id).
 */
export const assertProductBelongsToEmpresa = async (empresaId, productId) => {
  const normalizedEmpresa = String(empresaId || '').trim();
  const normalizedProduct = String(productId || '').trim();
  if (!normalizedEmpresa || !normalizedProduct) {
    throw badRequest('empresaId e productId obrigatórios');
  }

  try {
    const product = await findProductRef(normalizedEmpresa, normalizedProduct);
    if (!product) {
      throw forbidden('Produto não pertence ao cliente informado', {
        code: 'CATALOG_PRODUCT_TENANT_FORBIDDEN',
      });
    }
    return product;
  } catch (err) {
    if (err?.status === 404 || err?.statusCode === 404) {
      throw notFound('Produto não encontrado para este cliente');
    }
    throw err;
  }
};

export const resolveEstablishmentIdFromRequest = (req) => {
  const raw = req.query?.establishmentId
    ?? req.body?.establishmentId
    ?? req.headers?.['x-fiscal-establishment-id'];
  const normalized = digitsOnly(raw);
  return normalized || null;
};

export const requireEstablishmentIdFromRequest = (req) => {
  const establishmentId = resolveEstablishmentIdFromRequest(req);
  if (!establishmentId) {
    throw badRequest('establishmentId obrigatório para operação fiscal scoped');
  }
  return establishmentId;
};
