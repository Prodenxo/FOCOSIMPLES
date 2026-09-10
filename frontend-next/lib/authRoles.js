/** @typedef {'superadmin' | 'admin' | 'usuario' | 'outsider'} UserRole */

export function normalizeRoleValue(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'user') return 'usuario';
  if (normalized === 'superadmin') return 'superadmin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'usuario') return 'usuario';
  if (normalized === 'outsider') return 'outsider';
  return null;
}

/** @param {UserRole|null|undefined} role @param {UserRole[]} allowed */
export function hasRole(role, allowed) {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return allowed.includes(role);
}
