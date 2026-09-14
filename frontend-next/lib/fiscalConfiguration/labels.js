export const PRIOR_ST_STATUS_OPTIONS = [
  { value: 'RETAINED', label: 'ICMS-ST já retido anteriormente' },
  { value: 'NO_ST_EVIDENCE', label: 'Sem evidência de ST anterior' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
];

export const ITEM_SOURCE_OPTIONS = [
  { value: 'THIRD_PARTY', label: 'Mercadoria de terceiros (revenda)' },
  { value: 'OWN_PRODUCTION', label: 'Produção própria' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
];

export const ORIGEM_MERCADORIA_OPTIONS = [
  { value: '0', label: '0 — Nacional' },
  { value: '1', label: '1 — Estrangeira (importação direta)' },
  { value: '2', label: '2 — Estrangeira (mercado interno)' },
  { value: '3', label: '3 — Nacional (> 40% importado)' },
  { value: '4', label: '4 — Nacional (PPB)' },
  { value: '5', label: '5 — Nacional (< 40% importado)' },
  { value: '6', label: '6 — Estrangeira (sem similar)' },
  { value: '7', label: '7 — Estrangeira mercado interno (sem similar)' },
  { value: '8', label: '8 — Nacional (> 70% importado)' },
];

export const RECIPIENT_TAXPAYER_CONDITION_OPTIONS = [
  { value: 'ANY', label: 'Qualquer destinatário' },
  { value: 'NON_TAXPAYER', label: 'Não contribuinte ICMS' },
  { value: 'TAXPAYER', label: 'Contribuinte ICMS' },
  { value: 'EXEMPT', label: 'Isento' },
];

export const FINAL_CONSUMER_CONDITION_OPTIONS = [
  { value: 'ANY', label: 'Qualquer' },
  { value: 'YES', label: 'Somente consumidor final' },
  { value: 'NO', label: 'Somente não consumidor final' },
];

export const SCENARIO_APPLIES_OPTIONS = [
  { value: 'INTERNAL', label: 'Venda interna' },
  { value: 'INTERSTATE_ANY', label: 'Venda interestadual (qualquer UF)' },
  { value: 'INTERSTATE_UF', label: 'Venda interestadual — UF específica' },
  { value: 'FOREIGN', label: 'Exportação / exterior' },
];

export const PIS_COFINS_MODE_OPTIONS = [
  { value: 'OUTR_ZERO', label: 'Outras — zero explícito' },
  { value: 'NT', label: 'Não tributado' },
  { value: 'ALIQ_PERCENT', label: 'Alíquota percentual' },
];

export const CURRENT_OPERATION_ST_OPTIONS = [
  { value: 'NOT_DUE', label: 'ST não devida nesta operação' },
  { value: 'DUE_BY_ISSUER', label: 'ST devida pelo emitente' },
  { value: 'RETAINED', label: 'ST retida' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
];

export const FISCAL_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'READY', label: 'Pronto' },
  { value: 'INCOMPLETO', label: 'Incompleto' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'BLOQUEADO', label: 'Bloqueado' },
];

export function labelRuleStatus(status) {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho';
    case 'APPROVED':
      return 'Aprovada';
    case 'SUSPENDED':
      return 'Suspensa';
    case 'REVOKED':
      return 'Revogada';
    case 'EXPIRED':
      return 'Expirada';
    default:
      return status ?? '—';
  }
}

export function formatCapabilityMessage(capability) {
  if (!capability || capability.executable !== false) return null;
  const first = capability.issues?.[0]?.message;
  return first ?? 'Esta combinação fiscal ainda não é executável pelo motor de NF-e.';
}

export function labelFiscalStatus(status) {
  const map = {
    READY: 'Pronto',
    INCOMPLETO: 'Incompleto',
    PENDENTE: 'Pendente',
    BLOQUEADO: 'Bloqueado',
  };
  return map[status] ?? status ?? '—';
}
