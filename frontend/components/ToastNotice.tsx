import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { createPortal } from 'react-dom';
import { getWebPortalRoot } from '../lib/hardReload';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfSpacing } from '../lib/theme';

/** Acima de top nav (50), modais MEI (11000) e overlays. */
const TOAST_Z_INDEX = 30000;
const WEB_SHELL_TOP_MIN_WIDTH = 960;

export type ToastNoticeVariant = 'error' | 'success' | 'info';

type Props = {
  visible: boolean;
  message: string;
  variant?: ToastNoticeVariant;
  onDismiss: () => void;
  durationMs?: number;
};

export function ToastNotice({
  visible,
  message,
  variant = 'error',
  onDismiss,
  durationMs = 7000,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { isDarkMode } = useThemeStore();
  const theme = getTheme(isDarkMode);

  const useWebDock =
    Platform.OS === 'web' && windowWidth >= WEB_SHELL_TOP_MIN_WIDTH;
  const topOffset = Math.max(insets.top, 8) + 8;

  useEffect(() => {
    if (!visible || !message.trim()) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, message, durationMs, onDismiss]);

  if (!visible || !message.trim()) return null;

  const isError = variant === 'error';
  const isSuccess = variant === 'success';
  const accent = isError ? theme.error : isSuccess ? theme.success : theme.primary;
  const bg = isDarkMode
    ? isError
      ? 'rgba(127, 29, 29, 0.92)'
      : isSuccess
        ? 'rgba(6, 78, 59, 0.92)'
        : 'rgba(30, 58, 138, 0.92)'
    : isError
      ? 'rgba(254, 242, 242, 0.96)'
      : isSuccess
        ? 'rgba(236, 253, 245, 0.96)'
        : 'rgba(239, 246, 255, 0.96)';
  const border = isError
    ? isDarkMode
      ? 'rgba(248, 113, 113, 0.45)'
      : 'rgba(239, 68, 68, 0.35)'
    : isSuccess
      ? isDarkMode
        ? 'rgba(52, 211, 153, 0.4)'
        : 'rgba(16, 185, 129, 0.35)'
      : isDarkMode
        ? 'rgba(96, 165, 250, 0.4)'
        : 'rgba(37, 99, 235, 0.3)';

  const iconName = isError
    ? 'alert-circle-outline'
    : isSuccess
      ? 'checkmark-circle-outline'
      : 'information-circle-outline';

  const toastNode = (
    <View
      style={[
        styles.host,
        useWebDock ? styles.hostWebDock : { top: topOffset },
      ]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <Pressable
        style={[
          styles.box,
          {
            backgroundColor: bg,
            borderColor: border,
            ...(Platform.OS === 'web'
              ? {
                  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.18)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 12,
                }),
          },
        ]}
        onPress={onDismiss}
        accessibilityRole="alert"
      >
        <Ionicons name={iconName} size={20} color={accent} style={styles.icon} />
        <Text style={[styles.text, { color: theme.text }]} numberOfLines={5}>
          {message}
        </Text>
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </Pressable>
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const portalRoot = getWebPortalRoot();
    if (portalRoot) {
      return createPortal(toastNode, portalRoot);
    }
  }

  return toastNode;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 12,
    left: 12,
    zIndex: TOAST_Z_INDEX,
    alignItems: 'flex-end',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          zIndex: TOAST_Z_INDEX,
        } as const)
      : {}),
  },
  hostWebDock: {
    left: 'auto',
    top: 'auto',
    bottom: 24,
    right: 20,
    maxWidth: 400,
    width: 'auto',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: 400,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
