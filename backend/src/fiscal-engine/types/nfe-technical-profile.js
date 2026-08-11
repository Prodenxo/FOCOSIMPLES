/**
 * Perfil técnico NF-e — separado da versão interna do Fiscal Engine.
 */

import { ENGINE_SCHEMA_VERSION } from '../constants.js';

/** @typedef {55 | 65} NFeModelo */

/**
 * @typedef {object} NFeTechnicalProfile
 * @property {NFeModelo} modelo
 * @property {string} layoutVersion
 * @property {'production' | 'homologation'} [environment]
 * @property {string} effectiveDate
 * @property {string[]} technicalNotes
 * @property {string} validationRuleSetVersion
 */

export const DEFAULT_NFE_TECHNICAL_PROFILE = Object.freeze({
  modelo: 55,
  layoutVersion: '4.00',
  environment: 'production',
  effectiveDate: '2026-01-01',
  technicalNotes: [],
  validationRuleSetVersion: 'plugnotas-default',
});

/**
 * @param {Partial<NFeTechnicalProfile>} [overrides]
 * @returns {NFeTechnicalProfile}
 */
export const buildNFeTechnicalProfile = (overrides = {}) => ({
  ...DEFAULT_NFE_TECHNICAL_PROFILE,
  ...overrides,
  technicalNotes: [...(overrides.technicalNotes ?? DEFAULT_NFE_TECHNICAL_PROFILE.technicalNotes)],
});

/**
 * @param {Partial<NFeTechnicalProfile>} [nfeProfileOverrides]
 */
export const buildFiscalEngineMetadata = (nfeProfileOverrides = {}) => ({
  engineSchemaVersion: ENGINE_SCHEMA_VERSION,
  nfeTechnicalProfile: buildNFeTechnicalProfile(nfeProfileOverrides),
});
