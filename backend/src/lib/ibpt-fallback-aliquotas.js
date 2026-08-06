/**
 * Alíquotas médias estáticas por capítulo NCM (Lei 12.741/2012).
 * Usadas quando a API IBPT está indisponível (timeout/rede).
 * Percentuais inspirados em médias IBPT para varejo MEI.
 */

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/** @type {Record<string, { nacional: number, estadual: number, importado: number, municipal: number }>} */
export const IBPT_FALLBACK_BY_NCM_CHAPTER = {
  '04': { nacional: 7.12, estadual: 12, importado: 15.5, municipal: 0 },
  '09': { nacional: 8.5, estadual: 12, importado: 16, municipal: 0 },
  '10': { nacional: 6.5, estadual: 7, importado: 14, municipal: 0 },
  '16': { nacional: 9.8, estadual: 12, importado: 17, municipal: 0 },
  '17': { nacional: 11.2, estadual: 12, importado: 18, municipal: 0 },
  '19': { nacional: 10.5, estadual: 12, importado: 17.5, municipal: 0 },
  '20': { nacional: 10, estadual: 12, importado: 17, municipal: 0 },
  '21': { nacional: 11.5, estadual: 12, importado: 18, municipal: 0 },
  '22': { nacional: 13.45, estadual: 18, importado: 20.91, municipal: 0 },
  '23': { nacional: 9.5, estadual: 12, importado: 16.5, municipal: 0 },
  '30': { nacional: 12.5, estadual: 18, importado: 22, municipal: 0 },
  '33': { nacional: 14.2, estadual: 18, importado: 21, municipal: 0 },
  '34': { nacional: 13, estadual: 18, importado: 20, municipal: 0 },
  '39': { nacional: 12, estadual: 12, importado: 19, municipal: 0 },
  '40': { nacional: 11.5, estadual: 12, importado: 18.5, municipal: 0 },
  '42': { nacional: 11, estadual: 12, importado: 18, municipal: 0 },
  '48': { nacional: 10, estadual: 12, importado: 17, municipal: 0 },
  '61': { nacional: 13.5, estadual: 18, importado: 21, municipal: 0 },
  '62': { nacional: 13.5, estadual: 18, importado: 21, municipal: 0 },
  '63': { nacional: 13, estadual: 18, importado: 20.5, municipal: 0 },
  '68': { nacional: 11.8, estadual: 12, importado: 18, municipal: 0 },
  '84': { nacional: 15.5, estadual: 18, importado: 23, municipal: 0 },
  '87': { nacional: 12.8, estadual: 12, importado: 19.5, municipal: 0 },
};

export const IBPT_FALLBACK_DEFAULT = {
  nacional: 13.45,
  estadual: 12,
  importado: 20.91,
  municipal: 0,
};

/**
 * Resolve alíquotas estimadas por capítulo NCM (2 primeiros dígitos).
 * @param {string} ncm
 * @returns {import('../services/ibpt.service.js').IbptAliquotas & { estimated: true, cacheLayer: 'fallback' }}
 */
export const resolveIbptFallbackAliquotas = (ncm) => {
  const ncmNorm = onlyDigits(ncm, 8);
  const chapter = ncmNorm.slice(0, 2);
  const rates = IBPT_FALLBACK_BY_NCM_CHAPTER[chapter] || IBPT_FALLBACK_DEFAULT;

  return {
    nacional: rates.nacional,
    estadual: rates.estadual,
    importado: rates.importado,
    municipal: rates.municipal,
    fonte: 'IBPT',
    versao: 'estimativa-local',
    estimated: true,
    cacheLayer: 'fallback',
  };
};
