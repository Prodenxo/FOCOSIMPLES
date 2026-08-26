/**
 * Copy e URLs da área fiscal — produto Foco Simples (Simples Nacional).
 * Centraliza textos antes visíveis só quando `APP_PRODUCT=focosimples`.
 */

export const SIMPLES_DAS_PORTAL_FALLBACK =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/Identificacao';

export const DAS_PORTAL_URL = SIMPLES_DAS_PORTAL_FALLBACK;
export const DAS_PORTAL_LABEL = 'PGDAS-D';
export const DAS_PAGE_TITLE = 'Guia DAS (Simples Nacional)';
export const DAS_PAGE_DESC =
  'Consulte competências, gere o DAS (PGDAS-D) e baixe o PDF com certificado e-CNPJ.';

export const NOTAS_AREA_TITLE = 'Notas';
export const NOTAS_AREA_SUBTITLE = 'Emissão e acompanhamento fiscal.';
export const NOTAS_ACCESS_DENIED =
  'A emissão de notas está disponível para administradores e utilizadores com acesso fiscal liberado. Fale com o suporte se precisar de acesso.';
export const NOTAS_PAYWALL =
  'Sua conta está ativa, mas a emissão de notas só libera depois do pagamento do plano.';

export const CERT_PREFILL_MISSING =
  'Não há cadastro fiscal activo para preencher automaticamente. Complete o certificado ou preencha o prestador manualmente.';

export const DAS_PERIODO_INDISPONIVEL_HINT =
  'A Receita não emite DAS para esta competência (período inválido, futuro, decadente ou antes do enquadramento no Simples Nacional).';

export const DAS_TAB_LABEL = 'DAS Simples';
export const PARCELAMENTOS_SUBTITLE = 'Parcelamentos do Simples Nacional';
export const PLAN_PAYWALL_TITLE = 'Escolha um plano';

export const FISCAL_SLOT_LABEL = 'Simples Nacional';
export const FISCAL_SLOT_ENABLED = 'Emissão fiscal habilitada';
export const FISCAL_SLOT_DISABLED = 'Emissão fiscal desativada';
export const FISCAL_USER_TYPE_OTHER = 'PF / Outros';

export const EMPRESA_FISCAL_SLOTS_LABEL = 'Vagas fiscais (CNPJ)';
export const DAS_GUIDE_DIALOG_TITLE = 'Guia DAS (Simples Nacional)';
export const DAS_GUIDE_DIALOG_UPDATED = 'Guia DAS atualizada';
export const dasGuideDialogTitle = (periodoApuracao: string) =>
  `Guia DAS ${periodoApuracao}`;
export const FISCAL_CNPJ_FIELD_LABEL = 'CNPJ da empresa';
