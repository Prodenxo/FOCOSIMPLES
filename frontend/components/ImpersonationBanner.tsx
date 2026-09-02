import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfSpacing } from '../lib/theme';
import { useShellLayout } from './shell/useShellLayout';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT, SHELL_NAV_MAX_WIDTH } from './shell/shellTokens';
export default function ImpersonationBanner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isWebDesktop } = useShellLayout();
  const isWide = width >= 720;
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const canvasBg = isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT;
  const { styles, accent } = useMemo(
    () => createStyles(theme, isDarkMode, isWide, isWebDesktop, canvasBg),
    [theme, isDarkMode, isWide, isWebDesktop, canvasBg]
  );
  const displayName = useAuthStore((s) => s.displayName);
  const isImpersonating = useAuthStore((s) => s.isImpersonating);
  const stopImpersonating = useAuthStore((s) => s.stopImpersonating);
  const [busy, setBusy] = useState(false);

  if (!isImpersonating) return null;

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await stopImpersonating();
    } catch (error) {
      console.error('Erro ao encerrar impersonação:', error);
    } finally {
      setBusy(false);
    }
  };

  const label = (displayName || 'usuário').trim();
  const padTop =
    Platform.OS === 'web' && isWebDesktop ? 10 : Math.max(insets.top, 10);
  const glassWeb =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        } as object)
      : null;

  return (
    <View
      style={[styles.shellStrip, { paddingTop: padTop }]}
      accessibilityRole="alert"
    >
      <View style={[styles.glassCard, glassWeb]}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={isDarkMode ? 64 : 80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.glassTint} pointerEvents="none" />

        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={[styles.lead, isWide && styles.leadWide]}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color={accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.kicker}>Modo administrativo</Text>
              <Text style={styles.message} numberOfLines={2}>
                Visualizando como <Text style={styles.messageStrong}>{label}</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.exitBtn, busy && styles.exitBtnDisabled]}
            onPress={handleStop}
            disabled={busy}
            activeOpacity={0.82}
            accessibilityLabel="Sair do modo usuário"
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color={theme.primary} />
                <Text style={styles.exitBtnText}>Sair do modo usuário</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof getTheme>,
  isDarkMode: boolean,
  isWide: boolean,
  isWebDesktop: boolean,
  canvasBg: string
) => {
  const accent = isDarkMode ? '#fbbf24' : '#d97706';
  const accentSoft = isDarkMode ? 'rgba(251, 191, 36, 0.18)' : 'rgba(245, 158, 11, 0.16)';
  const glassBg = isDarkMode ? 'rgba(26, 34, 52, 0.72)' : 'rgba(255, 255, 255, 0.78)';
  const glassBorder = isDarkMode ? 'rgba(251, 191, 36, 0.32)' : 'rgba(245, 158, 11, 0.35)';
  const tintOverlay = isDarkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.14)';
  const hPad = isWebDesktop ? mfSpacing.lg : isWide ? 20 : mfSpacing.md;

  const styles = StyleSheet.create({
    shellStrip: {
      width: '100%',
      backgroundColor: canvasBg,
      paddingHorizontal: hPad,
      paddingBottom: isWebDesktop ? 6 : 10,
      zIndex: 2,
    },
    glassCard: {
      width: '100%',
      maxWidth: SHELL_NAV_MAX_WIDTH,
      alignSelf: 'center',
      borderRadius: isWebDesktop ? 14 : 16,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassBg,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDarkMode
              ? '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
              : '0 4px 18px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDarkMode ? 0.28 : 0.08,
            shadowRadius: 12,
            elevation: 4,
          }),
    },
    glassTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: tintOverlay,
    },
    content: {
      position: 'relative',
      zIndex: 1,
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 10,
    },
    contentWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    lead: {
      gap: 8,
    },
    leadWide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accentSoft,
      borderWidth: 1,
      borderColor: glassBorder,
      flexShrink: 0,
    },
    copy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: accent,
    },
    message: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
      lineHeight: 18,
    },
    messageStrong: {
      fontWeight: '700',
      color: theme.text,
    },
    exitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.45)' : 'rgba(37, 99, 235, 0.3)',
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.1)',
      alignSelf: isWide ? 'center' : 'stretch',
      flexShrink: 0,
    },
    exitBtnDisabled: {
      opacity: 0.6,
    },
    exitBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
  });

  return { styles, accent };
};
