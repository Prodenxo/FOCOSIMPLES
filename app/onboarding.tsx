import React from 'react'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import OnboardingScreen from '@/screens/OnboardingScreen'

export default function Onboarding() {
  const router = useRouter()

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true')
    router.replace('/(auth)/login')
  }

  return (
    <OnboardingScreen
      onStartActivation={() => void finishOnboarding()}
      onGoToApp={() => void finishOnboarding()}
    />
  )
}
