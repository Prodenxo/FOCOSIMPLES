/**
 * Regras de ações na lista Gerenciar usuários (inclui editar a própria conta).
 * Paridade com frontend/lib/managedUserActions.ts
 */
export function getManagedUserActions(actorRole, target, actorUserId) {
  if (!actorRole || !target?.id) {
    return { canEdit: false, canImpersonate: false, canDelete: false, canBan: false };
  }

  const isSelf = Boolean(actorUserId && target.id === actorUserId);
  const canManageTarget =
    isSelf && (actorRole === 'admin' || actorRole === 'superadmin')
      ? true
      : actorRole === 'superadmin'
        ? target.role !== 'superadmin'
        : actorRole === 'admin' && target.role === 'usuario';

  return {
    canEdit: canManageTarget,
    canImpersonate: canManageTarget && !isSelf,
    canDelete: canManageTarget && !isSelf,
    canBan: canManageTarget && !isSelf,
  };
}
