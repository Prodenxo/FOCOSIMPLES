import type { UserRole } from './auth-roles';

/**
 * Paridade com Meu Financeiro web: `App.tsx` / `Sidebar` (`canAccessMeiArea`).
 * MEI liberado só com `mei === true` no vínculo; superadmin mantém bypass operacional.
 */
export function canAccessMeiArea(role: UserRole | null, mei: boolean | null): boolean {
  if (role === 'superadmin') {
    return true;
  }
  if (role === 'admin' || role === 'usuario') {
    return mei === true;
  }
  return false;
}
