import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text, ScrollView, Platform } from 'react-native';
import { clearHardReloadQueryFromUrl, hideBootSplash, installWebStaleChunkRecovery } from '@/lib/hardReload';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeStore } from '@/store/themeStore';
import { ToastNotice } from '@/components/ToastNotice';
import { useAppToastStore } from '@/store/appToastStore';
import {
  capturePasswordRecoveryFromUrlSync,
  usePasswordRecoveryDeepLink,
  type PasswordRecoveryPayload,
} from '@/lib/passwordRecoveryDeepLink';
import ResetPasswordScreen from '@/screens/auth/ResetPasswordScreen';
import { isAppConfigured } from '@/lib/authMode';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';

type RecoveryUiState =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | ({ kind: 'recovery' } & PasswordRecoveryPayload);

function AppConfigScreen() {
  return (
    <ScrollView contentContainerStyle={styles.configContainer}>
      <Text style={styles.configTitle}>App não configurado</Text>
      <Text style={styles.configText}>
        Auth local (sem Supabase) — na raiz do projeto crie `.env`:
      </Text>
      <Text style={styles.configCode}>
        EXPO_PUBLIC_AUTH_MODE=local{'\n'}
        EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333{'\n'}
        EXPO_PUBLIC_APP_PRODUCT=focosimples
      </Text>
      <Text style={styles.configText}>Ou configure Supabase clássico:</Text>
      <Text style={styles.configCode}>
        EXPO_PUBLIC_SUPABASE_URL=...{'\n'}
        EXPO_PUBLIC_SUPABASE_ANON_KEY=...
      </Text>
      <Text style={styles.configSubtext}>
        Depois reinicie o Expo (`npm start -c`).
      </Text>
    </ScrollView>
  );
}


function RootLayoutInner() {
  const { initTheme, isDarkMode } = useThemeStore();
  const [recoveryState, setRecoveryState] = useState<RecoveryUiState>(() => {
    const captured = capturePasswordRecoveryFromUrlSync();
    if (captured) return { kind: 'recovery', ...captured };
    return { kind: 'none' };
  });
  const toastVisible = useAppToastStore((s) => s.visible);
  const toastMessage = useAppToastStore((s) => s.message);
  const toastVariant = useAppToastStore((s) => s.variant);
  const dismissToast = useAppToastStore((s) => s.dismiss);

  useEffect(() => { initTheme(); }, [initTheme]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    installWebStaleChunkRecovery();
    clearHardReloadQueryFromUrl();
    hideBootSplash();

    // Expo/dev ainda pode injetar favicon.ico antigo (JPG com fundo branco).
    // Força PNG transparente em public/ com query de cache-bust.
    try {
      const href = '/fm-mark.png?v=4';
      const head = document.head;
      head
        .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
        .forEach((node) => node.parentElement?.removeChild(node));
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = href;
      head.appendChild(link);
    } catch {
      /* ignore */
    }
  }, []);

  const recoveryHandlers = useMemo(
    () => ({
      onRecovery: (payload: PasswordRecoveryPayload) =>
        setRecoveryState({ kind: 'recovery', ...payload }),
      onInvalidRecoveryLink: () => setRecoveryState({ kind: 'invalid' }),
    }),
    []
  );
  usePasswordRecoveryDeepLink(recoveryHandlers);
  const closeRecovery = useCallback(() => setRecoveryState({ kind: 'none' }), []);

  if (!isAppConfigured()) {
    return <AppConfigScreen />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ToastNotice
        visible={toastVisible}
        message={toastMessage}
        variant={toastVariant}
        onDismiss={dismissToast}
        durationMs={4000}
      />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {recoveryState.kind !== 'none' ? (
        <View style={StyleSheet.absoluteFill}>
          {recoveryState.kind === 'invalid' ? (
            <ResetPasswordScreen invalidLink onClose={closeRecovery} />
          ) : recoveryState.mode === 'token_hash' ? (
            <ResetPasswordScreen
              tokenHash={recoveryState.tokenHash}
              onClose={closeRecovery}
            />
          ) : (
            <ResetPasswordScreen
              accessToken={recoveryState.accessToken}
              refreshToken={recoveryState.refreshToken}
              onClose={closeRecovery}
            />
          )}
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <RootLayoutInner />
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  configContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  configTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  configText: { fontSize: 15, color: '#374151', marginBottom: 8 },
  configCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  configSubtext: { fontSize: 14, color: '#6B7280', marginTop: 16 },
});
