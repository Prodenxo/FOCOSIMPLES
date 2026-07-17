import React from 'react'
import { useRouter, type Href } from 'expo-router'
import ManageUsersScreen from '@/screens/ManageUsersScreen'
import { SCREEN_TO_HREF } from '@/lib/appNavConfig'
import { resolvePostAuthHref } from '@/lib/authRedirect'
import { goBackToSettings } from '@/lib/settingsRoutes'

export default function ConfiguracoesUsuariosRoute() {
  const router = useRouter()
  return (
    <ManageUsersScreen
      onBack={() => goBackToSettings(router)}
      onImpersonateSuccess={() => {
        void resolvePostAuthHref(SCREEN_TO_HREF.MeuMei as Href).then((href) => {
          router.replace(href as never)
        })
      }}
    />
  )
}
