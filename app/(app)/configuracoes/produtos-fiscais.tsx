import React from 'react'
import { useRouter } from 'expo-router'
import AccountantFiscalProductsScreen from '@/screens/AccountantFiscalProductsScreen'
import { goBackToSettings } from '@/lib/settingsRoutes'

export default function ConfiguracoesProdutosFiscaisRoute() {
  const router = useRouter()
  return <AccountantFiscalProductsScreen onBack={() => goBackToSettings(router)} />
}
