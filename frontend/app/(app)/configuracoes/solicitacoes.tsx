import React from 'react'
import { useRouter } from 'expo-router'
import AccessApprovalsScreen from '@/screens/AccessApprovalsScreen'
import { goBackToSettings } from '@/lib/settingsRoutes'

export default function ConfiguracoesSolicitacoesRoute() {
  const router = useRouter()
  return <AccessApprovalsScreen onBack={() => goBackToSettings(router)} />
}
