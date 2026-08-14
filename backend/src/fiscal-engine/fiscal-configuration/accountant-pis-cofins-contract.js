/**
 * Contrato Phase 8E.4 — PIS/COFINS configurados pelo contador em approvedResult.
 *
 * Derivação de calculationMode:
 * - CST 07/08 → NT (relação inequívoca comprovada no contrato interno)
 * - CST 49/99 → exige calculationMode OUTR_ZERO explícito (legacy ≠ autoridade)
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  getPisCofinsGroupForCst,
  PIS_COFINS_CALCULATION_MODES,
  PIS_COFINS_EXECUTABLE_CSTS,
  PIS_COFINS_KNOWN_CSTS,
} from '../simples-nacional/pis-cofins-xml-group-contract.js';

/** Campos permitidos em approvedResult.pis / approvedResult.cofins. */
export const PIS_COFINS_CONFIG_ALLOWED_KEYS = Object.freeze([
  'cst',
  'calculationMode',
  'pPIS',
  'pCOFINS',
  'qBCProd',
  'vAliqProd',
]);

/** Valores finais — calculados pelo engine, não parâmetros. */
export const PIS_COFINS_FORBIDDEN_VALUE_KEYS = Object.freeze([
  'vBC',
  'vPIS',
  'vCOFINS',
  'vBCProd',
]);

/** CSTs com relação inequívoca CST → NT (derivação técnica permitida). */
export const PIS_COFINS_NT_DERIVABLE_CSTS = Object.freeze(new Set(['07', '08']));

/** CSTs que exigem calculationMode explícito (não derivar de legacy/catálogo). */
export const PIS_COFINS_EXPLICIT_MODE_CSTS = Object.freeze(new Set(['49', '99']));

const isPresent = (value) => value !== null && value !== undefined && value !== '';

const normalizeCst = (value) => String(value ?? '').trim().padStart(2, '0').slice(0, 2);

/**
 * Resolve calculationMode — sem defaults fiscais silenciosos para OUTR_ZERO.
 * @param {object} block
 * @returns {string | null}
 */
export const resolvePisCofinsCalculationMode = (block = {}) => {
  if (block.calculationMode != null && block.calculationMode !== '') {
    return String(block.calculationMode);
  }
  const cst = block.cst != null ? normalizeCst(block.cst) : null;
  if (cst && PIS_COFINS_NT_DERIVABLE_CSTS.has(cst)) {
    return PIS_COFINS_CALCULATION_MODES.NT;
  }
  return null;
};

/**
 * @param {object} block
 * @param {'pis' | 'cofins'} tax
 */
export const detectUnsupportedPisCofinsFields = (block = {}, tax = 'pis') => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  const code = tax === 'pis'
    ? 'ACCOUNTANT_RULE_UNSUPPORTED_PIS_FIELD'
    : 'ACCOUNTANT_RULE_UNSUPPORTED_COFINS_FIELD';

  for (const key of Object.keys(block ?? {})) {
    if (PIS_COFINS_FORBIDDEN_VALUE_KEYS.includes(key)) {
      issues.push(createFiscalIssue(
        code,
        `Campo "${key}" não permitido em ${tax} — valor final é calculado pelo engine.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: key, tax } },
      ));
      continue;
    }
    if (!PIS_COFINS_CONFIG_ALLOWED_KEYS.includes(key)) {
      issues.push(createFiscalIssue(
        code,
        `Campo "${key}" desconhecido em approvedResult.${tax}.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: key, tax } },
      ));
    }
  }
  return issues;
};

/**
 * Atomicidade PIS+COFINS — um presente exige o outro; ambos ausentes permitido.
 * @param {object} approvedResult
 */
export const validatePisCofinsPairAtomicity = (approvedResult = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  const hasPis = approvedResult.pis != null;
  const hasCofins = approvedResult.cofins != null;
  if (hasPis !== hasCofins) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_PIS_COFINS_PAIR_REQUIRED',
      hasPis
        ? 'approvedResult.cofins é obrigatório quando pis está configurado.'
        : 'approvedResult.pis é obrigatório quando cofins está configurado.',
      { blocksEmission: true, overrideAllowed: false, meta: { hasPis, hasCofins } },
    ));
  }
  return issues;
};

/**
 * @param {object} block
 * @param {'pis' | 'cofins'} tax
 */
export const validatePisCofinsConfigBlock = (block, tax = 'pis') => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];

  if (block == null) return issues;

  if (typeof block !== 'object' || Array.isArray(block)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `${tax} deve ser objeto.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: tax } },
    ));
    return issues;
  }

  issues.push(...detectUnsupportedPisCofinsFields(block, tax));

  const cst = block.cst != null ? normalizeCst(block.cst) : null;
  if (!cst) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `cst é obrigatório em approvedResult.${tax}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'cst', tax } },
    ));
    return issues;
  }

  if (!PIS_COFINS_KNOWN_CSTS.has(cst)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CST ${cst} desconhecido para ${tax}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'cst', tax, cst } },
    ));
  }

  const groupMeta = getPisCofinsGroupForCst(cst, tax);
  if (!groupMeta) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CST ${cst} sem grupo XML mapeado para ${tax}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'cst', tax, cst } },
    ));
    return issues;
  }

  const mode = resolvePisCofinsCalculationMode(block);

  if (PIS_COFINS_EXPLICIT_MODE_CSTS.has(cst)) {
    if (block.calculationMode == null || block.calculationMode === '') {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `CST ${cst} exige calculationMode explícito (OUTR_ZERO) — não derivar de legacy.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'calculationMode', tax, cst } },
      ));
    } else if (String(block.calculationMode) !== PIS_COFINS_CALCULATION_MODES.OUTR_ZERO) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `CST ${cst} só suporta calculationMode OUTR_ZERO nesta fase.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'calculationMode', tax, cst } },
      ));
    }
  }

  if (block.calculationMode != null
    && !Object.values(PIS_COFINS_CALCULATION_MODES).includes(String(block.calculationMode))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `calculationMode inválido em ${tax}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'calculationMode', tax } },
    ));
  }

  if (mode == null && !PIS_COFINS_NT_DERIVABLE_CSTS.has(cst)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `calculationMode ausente para CST ${cst} em ${tax}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'calculationMode', tax, cst } },
    ));
    return issues;
  }

  const effectiveMode = mode ?? groupMeta.calculationMode;

  if (effectiveMode === PIS_COFINS_CALCULATION_MODES.OUTR_ZERO) {
    const rateField = tax === 'pis' ? 'pPIS' : 'pCOFINS';
    if (!isPresent(block[rateField])) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `${rateField} é obrigatório para OUTR_ZERO — zero deve ser configurado explicitamente.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: rateField, tax } },
      ));
    } else {
      const num = Number(String(block[rateField]).replace(',', '.'));
      if (!Number.isFinite(num) || num < 0) {
        issues.push(createFiscalIssue(
          'ACCOUNTANT_RULE_VALIDATION_FAILED',
          `${rateField} deve ser numérico >= 0.`,
          { blocksEmission: true, overrideAllowed: false, meta: { field: rateField, tax } },
        ));
      }
    }
  }

  if (effectiveMode === PIS_COFINS_CALCULATION_MODES.ALIQ_PERCENT) {
    const rateField = tax === 'pis' ? 'pPIS' : 'pCOFINS';
    if (!isPresent(block[rateField])) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `${rateField} é obrigatório para modalidade ALIQ_PERCENT.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: rateField, tax } },
      ));
    }
  }

  if (effectiveMode === PIS_COFINS_CALCULATION_MODES.QTDE) {
    if (!isPresent(block.qBCProd) || !isPresent(block.vAliqProd)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'qBCProd e vAliqProd são obrigatórios para modalidade QTDE.',
        { blocksEmission: true, overrideAllowed: false, meta: { tax } },
      ));
    }
  }

  return issues;
};

/**
 * @param {object} approvedResult
 */
export const validatePisCofinsContract = (approvedResult = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  issues.push(...validatePisCofinsPairAtomicity(approvedResult));
  if (approvedResult.pis != null) {
    issues.push(...validatePisCofinsConfigBlock(approvedResult.pis, 'pis'));
  }
  if (approvedResult.cofins != null) {
    issues.push(...validatePisCofinsConfigBlock(approvedResult.cofins, 'cofins'));
  }
  return issues;
};

/**
 * @param {object} block
 * @param {'pis' | 'cofins'} tax
 */
export const isPisCofinsConfigExecutable = (block, tax = 'pis') => {
  if (!block?.cst) return true;
  const cst = normalizeCst(block.cst);
  return validatePisCofinsConfigBlock(block, tax).length === 0
    && PIS_COFINS_EXECUTABLE_CSTS.has(cst);
};

/**
 * @param {object} approvedResult
 */
export const hasCompletePisCofinsForExecution = (approvedResult = {}) => {
  const pisOk = approvedResult.pis == null || isPisCofinsConfigExecutable(approvedResult.pis, 'pis');
  const cofinsOk = approvedResult.cofins == null
    || isPisCofinsConfigExecutable(approvedResult.cofins, 'cofins');
  return pisOk && cofinsOk
    && validatePisCofinsPairAtomicity(approvedResult).length === 0;
};
