import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SCREEN_TO_HREF } from '@/lib/appNavConfig';
import { resolvePostAuthHref } from '@/lib/authRedirect';
import { isPasswordRecoveryPath } from '@/lib/passwordRecoveryDeepLink';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import LandingPage from '@/screens/LandingPage';

export default function RootIndex() {
  const { user, sessionRestored } = useAuthStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  /** Evita tela branca eterna se getSession/fetch travar em produção. */
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().sessionRestored) {
        console.warn('[Auth] Timeout ao restaurar sessão — liberando interface.');
        useAuthStore.setState({ sessionRestored: true });
      }
    }, 12_000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!sessionRestored || onboardingDone === null) return;

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        isPasswordRecoveryPath(window.location.pathname)
      ) {
        return;
      }
      if (user) {
        void resolvePostAuthHref(SCREEN_TO_HREF.MeuMei as Href).then((href) => {
          router.replace(href);
        });
      }
      // sem usuário → LandingPage renderizada abaixo
      return;
    }

    // mobile: fluxo original
    if (!onboardingDone) {
      router.replace('/onboarding');
    } else if (user) {
      void resolvePostAuthHref(SCREEN_TO_HREF.MeuMei as Href).then((href) => {
        router.replace(href);
      });
    } else {
      router.replace('/(auth)/login');
    }
  }, [sessionRestored, onboardingDone, user, router]);

  // Web + não autenticado → landing page
  if (Platform.OS === 'web' && sessionRestored && !user) {
    return <LandingPage />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.loadingText}>Carregando…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
});
