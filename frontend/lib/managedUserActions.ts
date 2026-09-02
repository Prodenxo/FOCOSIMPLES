import type { ManagedUser } from './user-management';

export type ManagedUserActionFlags = {
  canEdit: boolean;
  canImpersonate: boolean;
  canDelete: boolean;
  canBan: boolean;
};

/** Regras de ações na lista Gerenciar acessos (inclui editar/acessar a própria conta). */
export function getManagedUserActions(
  actorRole: string | null,
  target: ManagedUser,
  actorUserId?: string | null
): ManagedUserActionFlags {
  if (!actorRole || !target?.id) {
    return { canEdit: false, canImpersonate: false, canDelete: false, canBan: false };
  }

  const isSelf = !!actorUserId && target.id === actorUserId;
  const canManageTarget =
    isSelf && (actorRole === 'admin' || actorRole === 'superadmin')
      ? true
      : actorRole === 'superadmin'
        ? target.role !== 'superadmin'
        : actorRole === 'admin' && target.role === 'usuario';

  return {
    canEdit: canManageTarget,
    canImpersonate: canManageTarget,
    canDelete: canManageTarget && !isSelf,
    canBan: canManageTarget && !isSelf,
  };
};

/** Admin vê o toggle MEI se o módulo estiver ativo na empresa ou se já houver MEI na conta (para poder desligar). */
export function shouldShowAdminMeiToggle(
  empresas: Array<{ max_mei?: number | null }>,
  options: { meiActive: boolean; userHasMei?: boolean | null }
): boolean {
  const moduleActive = empresas.some((e) => (e.max_mei ?? 0) > 0);
  return moduleActive || options.meiActive || options.userHasMei === true;
}
