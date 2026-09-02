import { useMemo } from 'react'
import { Platform } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen'
import {
  capturePasswordRecoveryFromUrlSync,
  parsePasswordRecoveryUrl,
} from '@/lib/passwordRecoveryDeepLink'

export default function ResetPasswordRoute () {
  const router = useRouter()

  const parsed = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const captured = capturePasswordRecoveryFromUrlSync()
      if (captured) {
        return { kind: 'password_recovery' as const, ...captured }
      }
      return parsePasswordRecoveryUrl(window.location.href)
    }
    return { kind: 'invalid_recovery_link' as const }
  }, [])

  const onClose = () => {
    router.replace('/(auth)/login' as Href)
  }

  if (parsed.kind !== 'password_recovery') {
    return <ResetPasswordScreen invalidLink onClose={onClose} />
  }

  if (parsed.mode === 'token_hash') {
    return (
      <ResetPasswordScreen
        tokenHash={parsed.tokenHash}
        onClose={onClose}
      />
    )
  }

  return (
    <ResetPasswordScreen
      accessToken={parsed.accessToken}
      refreshToken={parsed.refreshToken}
      onClose={onClose}
    />
  )
}
