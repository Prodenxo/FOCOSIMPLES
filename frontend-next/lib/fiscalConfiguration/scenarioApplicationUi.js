export function scenarioAppliesToOperationScope(kind) {
  switch (kind) {
    case 'INTERNAL':
      return 'INTERNAL';
    case 'INTERSTATE_ANY':
    case 'INTERSTATE_UF':
      return 'INTERSTATE';
    case 'FOREIGN':
      return 'FOREIGN';
    default:
      return 'INTERNAL';
  }
}

export function defaultScenarioName(kind, specificUf = '') {
  switch (kind) {
    case 'INTERNAL':
      return 'Venda interna';
    case 'INTERSTATE_ANY':
      return 'Venda interestadual';
    case 'INTERSTATE_UF':
      return specificUf ? `Venda interestadual — ${specificUf}` : 'Venda interestadual (UF específica)';
    case 'FOREIGN':
      return 'Exportação / exterior';
    default:
      return 'Cenário fiscal';
  }
}

export function parseScenarioAppliesFromForm(form) {
  if (form.scenarioApplies) return form.scenarioApplies;
  const scope = form.operationScope || 'INTERNAL';
  if (scope === 'FOREIGN') return 'FOREIGN';
  if (scope === 'INTERSTATE') {
    const dest = String(form.specificDestinationUf || form.destinationUf || '').trim();
    return dest.length === 2 ? 'INTERSTATE_UF' : 'INTERSTATE_ANY';
  }
  return 'INTERNAL';
}

export function syncFormEstablishmentContext(form, establishmentIssuerUf) {
  const issuerUf = String(establishmentIssuerUf ?? form.issuerUf ?? '').trim().toUpperCase().slice(0, 2);
  const kind = parseScenarioAppliesFromForm(form);
  return {
    ...form,
    issuerUf,
    operationScope: scenarioAppliesToOperationScope(kind),
    scenarioApplies: kind,
  };
}
