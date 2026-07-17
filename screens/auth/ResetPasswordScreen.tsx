import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getSupabaseAuthMessagePt } from '../../lib/authErrors';
import { validatePasswordMatch, validateSignupPassword } from '../../lib/authValidation';
import { useAuthStore } from '../../store/authStore';
import { getTheme } from '../../lib/theme';
import { useThemeStore } from '../../store/themeStore';

type RecoveryStatus = 'validating_link' | 'ready' | 'invalid_link' | 'expired_or_invalid_token' | 'network_error' | 'updated';

export type ResetPasswordScreenProps = {
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
  invalidLink?: boolean;
  onClose: () => void;
};

function getRecoveryErrorMessage(error: unknown): { status: RecoveryStatus; message: string } {
  const msg = getSupabaseAuthMessagePt(error);
  const lower = msg.toLowerCase();
  const genericRecoveryError = 'Nao foi possivel validar o link de recuperacao. Solicite um novo link e tente novamente.';

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('internet') || lower.includes('conex')) {
    return {
      status: 'network_error',
      message: 'Nao foi possivel comunicar com o servidor. Verifique sua internet e tente novamente.',
    };
  }

  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('jwt') || lower.includes('token')) {
    return {
      status: 'expired_or_invalid_token',
      message: 'O link de recuperacao esta invalido ou expirou. Solicite um novo link na tela de login.',
    };
  }

  return {
    status: 'expired_or_invalid_token',
    message: genericRecoveryError,
  };
}

export default function ResetPasswordScreen({
  accessToken,
  refreshToken,
  tokenHash,
  invalidLink = false,
  onClose,
}: ResetPasswordScreenProps) {
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const signOut = useAuthStore((s) => s.signOut);

  const [status, setStatus] = useState<RecoveryStatus>(invalidLink ? 'invalid_link' : 'validating_link');
  const [message, setMessage] = useState<string>(
    invalidLink ? 'Link invalido. Volte ao login e solicite nova recuperacao de senha.' : 'Validando link de recuperacao...'
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrapRecovery = async () => {
      if (invalidLink) return;

      if (tokenHash) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) throw error;

          if (!cancelled) {
            setStatus('ready');
            setMessage('Defina sua nova senha para concluir a recuperacao.');
          }
        } catch (error: unknown) {
          const parsed = getRecoveryErrorMessage(error);
          if (!cancelled) {
            setStatus(parsed.status);
            setMessage(parsed.message);
          }
        }
        return;
      }

      if (!accessToken || !refreshToken) {
        if (!cancelled) {
          setStatus('invalid_link');
          setMessage('Link invalido. Volte ao login e solicite nova recuperacao de senha.');
        }
        return;
      }

      try {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!cancelled) {
          setStatus('ready');
          setMessage('Defina sua nova senha para concluir a recuperacao.');
        }
      } catch (error: unknown) {
        const parsed = getRecoveryErrorMessage(error);
        if (!cancelled) {
          setStatus(parsed.status);
          setMessage(parsed.message);
        }
      }
    };

    void bootstrapRecovery();
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, tokenHash, invalidLink]);

  const handleSubmit = async () => {
    const e1 = validateSignupPassword(password);
    if (e1) {
      setStatus('ready');
      setMessage(e1);
      return;
    }
    const e2 = validatePasswordMatch(password, confirmPassword);
    if (e2) {
      setStatus('ready');
      setMessage(e2);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await signOut();
      setStatus('updated');
      setMessage('Senha atualizada com sucesso. Entre novamente com a nova senha.');
    } catch (error: unknown) {
      const parsed = getRecoveryErrorMessage(error);
      setStatus(parsed.status);
      setMessage(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  const isBlockingState = status === 'invalid_link' || status === 'expired_or_invalid_token' || status === 'network_error';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Redefinir senha</Text>
            <Text style={styles.subtitle}>{message}</Text>

            {status === 'validating_link' ? (
              <View style={styles.centeredRow}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null}

            {status === 'ready' ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nova senha</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholder="Minimo 6 caracteres"
                      placeholderTextColor={theme.placeholder}
                    />
                    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.iconButton}>
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={theme.placeholder}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirmar nova senha</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholder="Repita a senha"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                </View>

                <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
                  <Text style={styles.buttonText}>{loading ? 'Atualizando...' : 'Atualizar senha'}</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {status === 'updated' || isBlockingState ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Voltar para login</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 20,
    },
    centeredRow: {
      alignItems: 'center',
      marginBottom: 8,
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.inputBackground,
    },
    input: {
      flex: 1,
      color: theme.inputText,
      fontSize: 15,
      paddingVertical: 12,
    },
    iconButton: {
      padding: 4,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 15,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    secondaryButtonText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
    },
  });
