/** Normaliza resposta de GET /auth/session (data = { session: {...} }). */
export function unwrapAuthSession(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const session = payload.session ?? payload;
  if (!session?.user?.id) return null;
  return session;
}
