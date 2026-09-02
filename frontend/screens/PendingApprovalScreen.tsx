import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { APP_BRAND_NAME } from '@/lib/appBrand';
import { getTheme } from '@/lib/theme';

/**
 * Exibida quando o usuário autenticado ainda está com profiles.status = 'pending'.
 * O acesso ao app só é liberado após aprovação do superadmin.
 */
export default function PendingApprovalScreen() {
  const { isDarkMode } = useThemeStore();
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="hourglass-outline" size={52} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Solicitação em análise</Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          Recebemos seu cadastro e a equipe {APP_BRAND_NAME} está analisando sua solicitação de acesso.
          Assim que ela for aprovada, você poderá usar o app normalmente.
        </Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          Você pode voltar mais tarde e fazer login de novo para verificar o status.
        </Text>
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          style={[
            styles.button,
            { borderColor: theme.primary },
            signingOut && styles.buttonDisabled,
          ]}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.primary }]}>Sair</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 13,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
