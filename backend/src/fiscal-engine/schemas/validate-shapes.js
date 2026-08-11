/**
 * Validação leve de schemas (Fase 0) — expandir com JSON Schema completo nas fases seguintes.
 */

/**
 * @param {unknown} issue
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export const validateFiscalIssueShape = (issue) => {
  const errors = [];
  if (!issue || typeof issue !== 'object') {
    return { ok: false, errors: ['issue deve ser objeto'] };
  }
  const o = /** @type {Record<string, unknown>} */ (issue);
  if (typeof o.code !== 'string' || !o.code) errors.push('code obrigatório');
  if (!['INFO', 'WARNING', 'REVIEW', 'ERROR'].includes(String(o.severity))) {
    errors.push('severity inválida');
  }
  if (typeof o.blocksEmission !== 'boolean') errors.push('blocksEmission deve ser boolean');
  if (typeof o.overrideAllowed !== 'boolean') errors.push('overrideAllowed deve ser boolean');
  if (typeof o.message !== 'string' || !o.message) errors.push('message obrigatório');
  return errors.length ? { ok: false, errors } : { ok: true };
};

/**
 * @param {unknown} profile
 */
export const validateNFeTechnicalProfileShape = (profile) => {
  const errors = [];
  if (!profile || typeof profile !== 'object') {
    return { ok: false, errors: ['nfeTechnicalProfile deve ser objeto'] };
  }
  const p = /** @type {Record<string, unknown>} */ (profile);
  if (p.modelo !== 55 && p.modelo !== 65) errors.push('modelo deve ser 55 ou 65');
  if (typeof p.layoutVersion !== 'string' || !p.layoutVersion) errors.push('layoutVersion obrigatório');
  if (typeof p.effectiveDate !== 'string') errors.push('effectiveDate obrigatório');
  if (!Array.isArray(p.technicalNotes)) errors.push('technicalNotes deve ser array');
  if (typeof p.validationRuleSetVersion !== 'string') errors.push('validationRuleSetVersion obrigatório');
  return errors.length ? { ok: false, errors } : { ok: true };
};

/**
 * @param {unknown} metadata
 */
export const validateFiscalEngineMetadataShape = (metadata) => {
  const errors = [];
  if (!metadata || typeof metadata !== 'object') {
    return { ok: false, errors: ['metadata deve ser objeto'] };
  }
  const m = /** @type {Record<string, unknown>} */ (metadata);
  if (typeof m.engineSchemaVersion !== 'string') errors.push('engineSchemaVersion obrigatório');
  const profileCheck = validateNFeTechnicalProfileShape(m.nfeTechnicalProfile);
  if (!profileCheck.ok) errors.push(...profileCheck.errors);
  return errors.length ? { ok: false, errors } : { ok: true };
};

/**
 * Regra fiscal — applicableCrt explícito obrigatório (v3.1).
 * @param {unknown} rule
 */
export const validateFiscalRuleShape = (rule) => {
  const errors = [];
  if (!rule || typeof rule !== 'object') {
    return { ok: false, errors: ['rule deve ser objeto'] };
  }
  const r = /** @type {Record<string, unknown>} */ (rule);
  if (typeof r.id !== 'string') errors.push('id obrigatório');
  if (typeof r.ruleType !== 'string') errors.push('ruleType obrigatório');
  if (typeof r.schemaVersion !== 'string') errors.push('schemaVersion obrigatório');
  if (!Array.isArray(r.applicableCrt) || r.applicableCrt.length === 0) {
    errors.push('applicableCrt explícito obrigatório (não inferir todos CRTs)');
  }
  if (typeof r.effectiveFrom !== 'string') errors.push('effectiveFrom obrigatório');
  if (typeof r.sourceLegalReference !== 'string') errors.push('sourceLegalReference obrigatório');
  if (typeof r.productionReady !== 'boolean') errors.push('productionReady obrigatório');
  return errors.length ? { ok: false, errors } : { ok: true };
};
