import { isMeiSlotUser } from './meiUserSlot'
import type { ManagedUser } from './user-management'
import type { EmpresaOption } from '../services/empresaService'

export function isEmpresaMeiModuleActive (
  empresa: Pick<EmpresaOption, 'max_mei'>,
): boolean {
  const limite =
    empresa.max_mei === null || empresa.max_mei === undefined
      ? 0
      : Number(empresa.max_mei) || 0
  return limite > 0
}

/** Gerenciar usuários no FocoMEI: só quem tem vaga MEI liberada. */
export function filterFocoMeiAdminUsers (users: ManagedUser[]): ManagedUser[] {
  return users.filter((user) => isMeiSlotUser(user.mei))
}

/** Gerenciar empresas no FocoMEI: só empresas com módulo MEI ativo. */
export function filterFocoMeiAdminEmpresas (empresas: EmpresaOption[]): EmpresaOption[] {
  return empresas.filter(isEmpresaMeiModuleActive)
}

/** Membros de uma empresa MEI — inclui PF/Outros para o admin liberar vaga. */
export function listEmpresaMembersForMeiAdmin (
  users: ManagedUser[],
  empresaId: string,
  role?: string | null,
): ManagedUser[] {
  return users.filter((user) => {
    if (user.empresaId !== empresaId) return false
    if (role === 'admin') {
      return user.role !== 'superadmin' && user.role !== 'outsider'
    }
    return true
  })
}
