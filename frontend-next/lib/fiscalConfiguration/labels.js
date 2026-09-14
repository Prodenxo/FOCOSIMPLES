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

export function labelFiscalStatus(status) {
  const map = {
    READY: 'Pronto',
    INCOMPLETO: 'Incompleto',
    PENDENTE: 'Pendente',
    BLOQUEADO: 'Bloqueado',
  };
  return map[status] ?? status ?? '—';
}
