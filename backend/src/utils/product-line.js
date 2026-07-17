const PRODUCT_LINES = new Set(['focomei', 'financeiro', 'both']);

export const isFocoMeiApiDeploy = () =>
  String(process.env.APP_PRODUCT || '').trim().toLowerCase() === 'focomei';

export const normalizeProductLine = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return PRODUCT_LINES.has(text) ? text : null;
};

export const isEmpresaMeiModuleActive = (maxMei) => Number(maxMei || 0) > 0;

export const isMeiSlotUserLink = (mei) => mei === true;

/** Sem coluna no banco: quem tem vaga MEI é cliente FocoMEI na prática. */
export const deriveUserProductLine = (mei) =>
  (isMeiSlotUserLink(mei) ? 'focomei' : 'financeiro');

/** Sem coluna no banco: empresa com módulo MEI ligado = FocoMEI. */
export const deriveEmpresaProductLine = (maxMei) =>
  (isEmpresaMeiModuleActive(maxMei) ? 'focomei' : 'financeiro');
