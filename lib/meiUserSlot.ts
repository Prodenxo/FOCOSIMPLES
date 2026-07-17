/**
 * Vaga MEI no vínculo empresa × usuário (`role_x_user_x_empresa.mei`).
 * Só `true` ocupa vaga MEI; `false` e `null` são PF / Outros na UI administrativa.
 */
export function isMeiSlotUser(mei: boolean | null | undefined): boolean {
  return mei === true;
}

export function getMeiUserTypeLabel(mei: boolean | null | undefined): 'MEI' | 'PF / Outros' {
  return isMeiSlotUser(mei) ? 'MEI' : 'PF / Outros';
}

export function getMeiUserStatusShort(mei: boolean | null | undefined): string {
  if (mei === true) return 'MEI habilitado';
  if (mei === false) return 'MEI desativado';
  return 'PF / Outros';
}
