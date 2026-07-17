import React, { useCallback, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  MfConfirmDialog,
} from '../ui/MfConfirmDialog'
import {
  NavigationContext,
  type NavigationContextValue,
} from '../../lib/navigationContext'

type Props = {
  children: React.ReactNode
  nav: Omit<NavigationContextValue, 'requestSignOut'>
}

export function SignOutProvider ({ children, nav }: Props) {
  const signOut = useAuthStore((s) => s.signOut)
  const [logoutDialog, setLogoutDialog] = useState<'confirm' | 'error' | null>(
    null,
  )
  const [loggingOut, setLoggingOut] = useState(false)

  const requestSignOut = useCallback(() => {
    if (nav.shellLocked) return
    setLogoutDialog('confirm')
  }, [nav.shellLocked])

  const closeLogoutDialog = useCallback(() => {
    if (loggingOut) return
    setLogoutDialog(null)
  }, [loggingOut])

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await signOut()
      setLogoutDialog(null)
    } catch (error: unknown) {
      console.error('Erro ao fazer logout:', error)
      setLogoutDialog('error')
    } finally {
      setLoggingOut(false)
    }
  }, [signOut])

  const contextValue = useMemo(
    () => ({ ...nav, requestSignOut }),
    [nav, requestSignOut],
  )

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
      <MfConfirmDialog
        visible={logoutDialog !== null}
        variant={logoutDialog === 'error' ? 'error' : 'confirm'}
        confirmIntent="danger"
        iconName="log-out-outline"
        title={logoutDialog === 'error' ? 'Erro ao sair' : 'Sair da conta?'}
        message={
          logoutDialog === 'error'
            ? 'Não foi possível encerrar a sessão. Tente novamente.'
            : 'Você precisará fazer login novamente para acessar seus dados neste dispositivo.'
        }
        confirmLabel={logoutDialog === 'error' ? 'OK' : 'Sair'}
        cancelLabel="Cancelar"
        loading={loggingOut}
        onConfirm={
          logoutDialog === 'confirm' ? () => void performLogout() : undefined
        }
        onCancel={closeLogoutDialog}
      />
    </NavigationContext.Provider>
  )
}
