/**
 * Mascara CNPJ/CPF em path ou URL usados só em log ([plugnotas] requestJson / requestFormData).
 * Mitigação QA US-MEI-FISC-04: query `cpfCnpj=` e segmento `/empresa/:14dígitos` não aparecem literais completos.
 * @param {string} pathOrUrl
 * @returns {string}
 */
export const maskPlugnotasPathOrUrlForLog = (pathOrUrl) => {
  if (pathOrUrl == null || typeof pathOrUrl !== 'string') return String(pathOrUrl ?? '');
  let s = pathOrUrl;
  s = s.replace(/\/empresa\/(\d{14})(?=\?|#|$)/gi, (_m, digits) => (
    `/empresa/${digits.slice(0, 2)}***${digits.slice(-2)}`
  ));
  s = s.replace(/([?&]cpfCnpj=)([^&#'"]*)/gi, (_m, pref, val) => {
    try {
      const decoded = decodeURIComponent(val);
      const digits = decoded.replace(/\D/g, '');
      if (digits.length >= 4) return `${pref}${digits.slice(0, 2)}***${digits.slice(-2)}`;
    } catch {
      /* decode opcional */
    }
    return `${pref}***`;
  });
  return s;
};
