/** @see lib/empresaBusinessType.ts */

export const DEFAULT_BUSINESS_TYPE = 'RESELLER';

export const normalizeBusinessType = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'MANUFACTURER') return 'MANUFACTURER';
  return 'RESELLER';
};

export const extractBusinessTypeFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return DEFAULT_BUSINESS_TYPE;
  return normalizeBusinessType(payload.businessType ?? payload.business_type);
};

export const stripBusinessTypeFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return DEFAULT_BUSINESS_TYPE;
  const businessType = extractBusinessTypeFromPayload(payload);
  delete payload.businessType;
  delete payload.business_type;
  return businessType;
};

export const parseBusinessTypeFromMirrorJson = (raw) => {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_BUSINESS_TYPE;
  }
  return normalizeBusinessType(/** @type {Record<string, unknown>} */ (raw).business_type
    ?? /** @type {Record<string, unknown>} */ (raw).businessType);
};
