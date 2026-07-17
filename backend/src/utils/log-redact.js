/**
 * Remove segredo de convite de URLs para logs HTTP (ex.: morgan), evitando vazar token em access.
 * @param {string} [originalUrl]
 */
export const redactSensitiveUrlsForLog = (originalUrl) => {
  const u = originalUrl || '';
  if (!u.includes('/invites/validate')) return u;
  const q = u.indexOf('?');
  if (q === -1) return u;
  return `${u.slice(0, q)}?token=[REDACTED]`;
};
