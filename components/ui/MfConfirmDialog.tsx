import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { getTheme, mfAgendaPanelChrome, mfRadius, mfSpacing, mfTypography } from '../../lib/theme';

export type MfConfirmDialogVariant = 'confirm' | 'success' | 'error' | 'info';

export type MfConfirmDialogIntent = 'danger' | 'warning' | 'primary' | 'success';

export interface MfConfirmDialogProps {
  visible: boolean;
  variant?: MfConfirmDialogVariant;
  /** Cor do botão principal em variant="confirm" (padrão: danger). */
  confirmIntent?: MfConfirmDialogIntent;
  /** Ícone customizado (sobrescreve o padrão da variant). */
  iconName?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}

const VARIANT_META: Record<
  MfConfirmDialogVariant,
  { icon: keyof typeof Ionicons.glyphMap; toneKey: 'error' | 'success' | 'primary' | 'warning' }
> = {
  confirm: { icon: 'help-circle-outline', toneKey: 'warning' },
  success: { icon: 'checkmark-circle', toneKey: 'success' },
  error: { icon: 'alert-circle', toneKey: 'error' },
  info: { icon: 'information-circle-outline', toneKey: 'primary' },
};

function resolveIntentColor(
  theme: ReturnType<typeof getTheme>,
  intent: MfConfirmDialogIntent,
): string {
  switch (intent) {
    case 'danger':
      return theme.error;
    case 'warning':
      return theme.warning;
    case 'success':
      return theme.success;
    default:
      return theme.primary;
  }
}

export function MfConfirmDialog({
  visible,
  variant = 'confirm',
  confirmIntent = 'danger',
  iconName,
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: MfConfirmDialogProps) {
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const s = useMemo(() => createStyles(theme, isDarkMode), [theme, isDarkMode]);
  const meta = VARIANT_META[variant];
  const accentTone =
    variant === 'confirm'
      ? resolveIntentColor(theme, confirmIntent)
      : meta.toneKey === 'error'
        ? theme.error
        : meta.toneKey === 'success'
          ? theme.success
          : meta.toneKey === 'warning'
            ? theme.warning
            : theme.primary;
  const icon = iconName ?? meta.icon;

  const primaryLabel =
    confirmLabel ??
    (variant === 'confirm' ? 'Confirmar' : variant === 'error' ? 'Entendi' : 'OK');

  const showCancel = variant === 'confirm' && !loading;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={s.dialog} onPress={() => {}}>
          <View style={[s.iconRing, { borderColor: `${accentTone}44`, backgroundColor: `${accentTone}18` }]}>
            <Ionicons name={icon} size={32} color={accentTone} />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          {detail ? (
            <Text
              style={[
                s.detail,
                { color: variant === 'error' ? theme.error : theme.textSecondary },
              ]}
            >
              {detail}
            </Text>
          ) : null}

          <View style={s.actions}>
            {showCancel ? (
              <Pressable
                onPress={onCancel}
                disabled={loading}
                style={({ pressed }) => [
                  s.btn,
                  s.btnGhost,
                  { borderColor: theme.border },
                  pressed && s.pressed,
                  loading && s.disabled,
                ]}
              >
                <Text style={[s.btnGhostText, { color: theme.text }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                if (variant === 'confirm' && onConfirm) {
                  onConfirm();
                } else {
                  onCancel();
                }
              }}
              disabled={loading}
              style={({ pressed }) => [
                s.btn,
                variant === 'confirm' ? s.btnDanger : s.btnPrimary,
                {
                  backgroundColor: accentTone,
                  flex: 1,
                },
                pressed && s.pressed,
                loading && s.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.btnPrimaryText}>{primaryLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof getTheme>, isDarkMode: boolean) {
  const panelChrome = mfAgendaPanelChrome(isDarkMode) as ViewStyle;

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: mfSpacing.lg,
    },
    dialog: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.card,
      borderRadius: mfRadius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: mfSpacing.lg,
      alignItems: 'center',
      ...panelChrome,
    },
    iconRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: mfSpacing.md,
    },
    title: {
      ...mfTypography.subtitle,
      fontSize: 18,
      color: theme.text,
      textAlign: 'center',
      marginBottom: mfSpacing.sm,
    },
    message: {
      ...mfTypography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: mfSpacing.md,
    },
    detail: {
      ...mfTypography.caption,
      textAlign: 'center',
      marginBottom: mfSpacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      width: '100%',
      marginTop: mfSpacing.xs,
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      borderRadius: mfRadius.pill,
      minHeight: 44,
    },
    btnGhost: {
      backgroundColor: theme.backgroundMuted,
      borderWidth: 1,
    },
    btnGhostText: {
      ...mfTypography.bodyStrong,
    },
    btnPrimary: {},
    btnDanger: {},
    btnPrimaryText: {
      ...mfTypography.bodyStrong,
      color: '#FFFFFF',
    },
    pressed: { opacity: 0.88 },
    disabled: { opacity: 0.65 },
  });
}
