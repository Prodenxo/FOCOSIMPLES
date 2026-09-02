/**
 * Vaga MEI no vínculo empresa × usuário (`role_x_user_x_empresa.mei`).
 * Só `true` ocupa vaga MEI; `false` e `null` são PF / Outros na UI administrativa.
 */
export function isMeiSlotUser(mei: boolean | null | undefined): boolean {
  return mei === true;
}

export function getMeiUserTypeLabel(mei: boolean | null | undefined): 'Simples Nacional' | 'PF / Outros' {
  return isMeiSlotUser(mei) ? 'Simples Nacional' : 'PF / Outros';
}

export function getMeiUserStatusShort(mei: boolean | null | undefined): string {
  if (mei === true) return 'Emissão fiscal habilitada';
  if (mei === false) return 'Emissão fiscal desativada';
  return 'PF / Outros';
}

/** @deprecated use getMeiUserTypeLabel */
export const getFiscalUserTypeLabel = getMeiUserTypeLabel;

/** @deprecated use getMeiUserStatusShort */
export const getFiscalUserStatusShort = getMeiUserStatusShort;
