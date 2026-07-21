import type { UserRole } from './auth-roles';

/**
 * Acesso à área fiscal / Notas.
 * Só aparece com liberação explícita no vínculo (`mei === true`).
 * No Foco Simples o flag `mei` = “emissão fiscal liberada” (Simples Nacional).
 * Sem bypass de superadmin na UI — a aba some até alguém ativar o acesso no admin.
 */
export function canAccessMeiArea(role: UserRole | null, mei: boolean | null): boolean {
  if (role !== 'superadmin' && role !== 'admin' && role !== 'usuario') {
    return false;
  }
  return mei === true;
}

/** Alias de produto para copy/nav. */
export function canAccessNotasArea(role: UserRole | null, mei: boolean | null): boolean {
  return canAccessMeiArea(role, mei);
}
