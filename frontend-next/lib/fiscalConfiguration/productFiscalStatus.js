const BLOCKED_RULE_STATUSES = ['SUSPENDED', 'REVOKED', 'EXPIRED'];

export function ruleMatchesEstablishment(rule, establishmentId) {
  const ruleEst = String(rule.establishmentId ?? '').replace(/\D/g, '');
  const currentEst = String(establishmentId ?? '').replace(/\D/g, '');
  if (!ruleEst) return true;
  return ruleEst === currentEst;
}

export function ruleMatchesProduct(rule, productId, fiscalProductGroupId) {
  const conditions = rule.conditions ?? {};
  const productIds = Array.isArray(conditions.productId) ? conditions.productId.map(String) : [];
  if (productIds.includes(productId)) return true;
  if (!fiscalProductGroupId) return false;
  const groupIds = Array.isArray(conditions.fiscalProductGroupId)
    ? conditions.fiscalProductGroupId.map(String)
    : [];
  return groupIds.includes(fiscalProductGroupId);
}

export function findRulesForProductAtEstablishment(rules, productId, fiscalProductGroupId, establishmentId) {
  return rules
    .filter((rule) => ruleMatchesEstablishment(rule, establishmentId))
    .filter((rule) => ruleMatchesProduct(rule, productId, fiscalProductGroupId))
    .sort((a, b) => {
      if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
      if (b.status === 'APPROVED' && a.status !== 'APPROVED') return 1;
      return (b.version ?? 0) - (a.version ?? 0);
    });
}

export function deriveProductFiscalUiStatus(rules, preview) {
  const primary = rules[0];
  if (!primary) return 'PENDENTE';
  if (BLOCKED_RULE_STATUSES.includes(primary.status)) return 'BLOQUEADO';
  if (primary.status === 'APPROVED') return 'READY';
  if (primary.status === 'DRAFT') {
    if (preview?.capability?.executable === false || preview?.validation?.ok === false) {
      return 'BLOQUEADO';
    }
    return 'INCOMPLETO';
  }
  return 'PENDENTE';
}

export function pickPrimaryRule(rules) {
  return rules[0] ?? null;
}

const normalizeEstablishmentDigits = (value) => String(value ?? '').replace(/\D/g, '');

export function resolveEstablishmentSelection(current, establishments) {
  const currentDigits = normalizeEstablishmentDigits(current);
  if (currentDigits) {
    const matched = establishments.find(
      (e) => normalizeEstablishmentDigits(e.establishmentId) === currentDigits,
    );
    if (matched) return matched.establishmentId;
  }
  return establishments[0]?.establishmentId ?? '';
}
