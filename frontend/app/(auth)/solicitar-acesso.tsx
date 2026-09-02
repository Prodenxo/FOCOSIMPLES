import React from 'react'
import { useRouter, type Href } from 'expo-router'
import { AccessRequestForm } from '@/screens/auth/AccessRequestForm'
import { SCREEN_TO_HREF } from '@/lib/appNavConfig'
import { resolvePostAuthHref } from '@/lib/authRedirect'

/** Cadastro comercial — liberação imediata e entrada no app. */
export default function SolicitarAcessoScreen() {
  const router = useRouter()

  const goToApp = async () => {
    const href = await resolvePostAuthHref(SCREEN_TO_HREF.Dashboard as Href)
    router.replace(href)
  }

  return (
    <AccessRequestForm
      signupMode="self_serve"
      onGoToLogin={() => router.replace('/(auth)/login')}
      onDone={() => router.replace('/(auth)/login')}
      onRegistered={() => {
        void goToApp()
      }}
    />
  )
}
