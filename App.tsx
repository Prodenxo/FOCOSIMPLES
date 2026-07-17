import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { useThemeStore } from './store/themeStore';
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen';
import { usePasswordRecoveryDeepLink, type PasswordRecoveryPayload } from './lib/passwordRecoveryDeepLink';

type RecoveryUiState =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | ({ kind: 'recovery' } & PasswordRecoveryPayload);

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after {
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const { initTheme, isDarkMode } = useThemeStore();
  const [recoveryState, setRecoveryState] = useState<RecoveryUiState>({ kind: 'none' });

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const recoveryHandlers = useMemo(
    () => ({
      onRecovery: (payload: PasswordRecoveryPayload) => setRecoveryState({ kind: 'recovery', ...payload }),
      onInvalidRecoveryLink: () => setRecoveryState({ kind: 'invalid' }),
    }),
    []
  );
  usePasswordRecoveryDeepLink(recoveryHandlers);

  const closeRecovery = useCallback(() => setRecoveryState({ kind: 'none' }), []);

  return (
    <SafeAreaProvider>
      {recoveryState.kind === 'none' ? (
        <AppNavigator />
      ) : recoveryState.kind === 'invalid' ? (
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
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
