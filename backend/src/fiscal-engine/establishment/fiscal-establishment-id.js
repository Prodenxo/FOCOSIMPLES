/**
 * Canonical establishmentId — CNPJ emitente normalizado (14 dígitos).
 * Boundary fiscal dentro de um workspace (tenantId = empresaId).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

export const FISCAL_ESTABLISHMENT_ISSUE_CODE = 'FISCAL_ESTABLISHMENT_REQUIRED';

const onlyDigits = (value, max = 14) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * Normaliza cpfCnpj emitente para establishmentId canônico.
 * NF-e empresarial: 14 dígitos. CPF (11) não é establishment empresarial válido.
 * @param {unknown} cpfCnpj
 * @returns {string | null}
 */
export const normalizeEstablishmentIdFromEmitenteCpfCnpj = (cpfCnpj) => {
  const digits = onlyDigits(cpfCnpj, 14);
  if (digits.length !== 14) return null;
  return digits;
};

/**
 * @param {object} [payload]
 * @returns {string | null}
 */
export const resolveEstablishmentIdFromPayload = (payload) => {
  const emitente = payload?.emitente && typeof payload.emitente === 'object'
    ? payload.emitente
    : {};
  return normalizeEstablishmentIdFromEmitenteCpfCnpj(
    emitente.cpfCnpj ?? emitente.cnpj ?? emitente.document,
  );
};

/**
 * @param {unknown} cpfCnpj
 * @returns {{ ok: true, establishmentId: string } | { ok: false, establishmentId: null, issue: import('../types/fiscal-issue.js').FiscalIssue }}
 */
export const requireAuthoritativeEstablishmentId = (cpfCnpj) => {
  const establishmentId = normalizeEstablishmentIdFromEmitenteCpfCnpj(cpfCnpj);
  if (!establishmentId) {
    return {
      ok: false,
      establishmentId: null,
      issue: createFiscalIssue(
        FISCAL_ESTABLISHMENT_ISSUE_CODE,
        'CNPJ emitente válido é obrigatório para delimitar a entidade fiscal (establishmentId).',
        { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
      ),
    };
  }
  return { ok: true, establishmentId };
};

/**
 * @param {object} params
 * @param {unknown} params.payloadEmitenteCpfCnpj
 * @param {unknown} [params.fiscalContextEstablishmentId]
 * @param {unknown} [params.configurationEstablishmentId]
 * @param {unknown} [params.stockEstablishmentId]
 * @param {unknown} [params.rolloutEstablishmentId]
 */
export const assertEstablishmentBoundaryInvariant = ({
  payloadEmitenteCpfCnpj,
  fiscalContextEstablishmentId = null,
  configurationEstablishmentId = null,
  stockEstablishmentId = null,
  rolloutEstablishmentId = null,
}) => {
  const canonical = normalizeEstablishmentIdFromEmitenteCpfCnpj(payloadEmitenteCpfCnpj);
  const scopes = [
    ['fiscalContext', fiscalContextEstablishmentId],
    ['configuration', configurationEstablishmentId],
    ['stock', stockEstablishmentId],
    ['rollout', rolloutEstablishmentId],
  ].filter(([, value]) => value != null && value !== '');

  /** @type {string[]} */
  const mismatches = [];
  for (const [label, value] of scopes) {
    if (String(value) !== String(canonical)) {
      mismatches.push(`${label}=${value}`);
    }
  }

  if (!canonical) {
    return {
      ok: false,
      establishmentId: null,
      issue: createFiscalIssue(
        FISCAL_ESTABLISHMENT_ISSUE_CODE,
        'CNPJ emitente ausente ou inválido para invariante de boundary fiscal.',
        { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
      ),
    };
  }

  if (mismatches.length) {
    return {
      ok: false,
      establishmentId: canonical,
      issue: createFiscalIssue(
        'FISCAL_ESTABLISHMENT_BOUNDARY_MISMATCH',
        `Divergência de establishmentId — emitente=${canonical}; ${mismatches.join('; ')}`,
        {
          severity: 'ERROR',
          blocksEmission: true,
          overrideAllowed: false,
          meta: { canonical, mismatches },
        },
      ),
    };
  }

  return { ok: true, establishmentId: canonical, issue: null };
};

/**
 * Filtra regras contador para escopo exato de establishment (authoritative).
 * Regras sem establishmentId (wildcard) são excluídas quando requireExact=true.
 * @param {object[]} rules
 * @param {string} establishmentId
 * @param {{ requireExact?: boolean }} [options]
 */
export const filterAccountantRulesForEstablishment = (
  rules,
  establishmentId,
  options = {},
) => {
  const target = String(establishmentId ?? '').trim();
  if (!target) return [];
  const list = Array.isArray(rules) ? rules : [];
  if (options.requireExact) {
    return list.filter((rule) => String(rule.establishmentId ?? '') === target);
  }
  return list.filter((rule) => (
    !rule.establishmentId || String(rule.establishmentId) === target
  ));
};
