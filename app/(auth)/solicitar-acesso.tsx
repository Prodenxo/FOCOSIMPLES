import React from 'react'
import { useRouter } from 'expo-router'
import { AccessRequestForm } from '@/screens/auth/AccessRequestForm'

/** Pedido de acesso comercial/manual — sem Checkout Stripe. */
export default function SolicitarAcessoScreen() {
  const router = useRouter()
  return (
    <AccessRequestForm
      signupMode="manual_approval"
      onGoToLogin={() => router.replace('/(auth)/login')}
      onDone={() => router.replace('/(auth)/login')}
    />
  )
}
