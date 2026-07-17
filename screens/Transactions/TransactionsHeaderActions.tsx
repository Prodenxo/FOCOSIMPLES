import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';
import { mfRadius } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';

type ActionLayout = 'full' | 'compact' | 'icons';

type Props = {
  theme: Theme;
  exporting?: boolean;
  onExport: () => void;
  onAddTransaction: () => void;
  /** `auto` escolhe rótulos conforme a largura — evita cortar texto em monitores estreitos. */
  variant?: ActionLayout | 'auto';
};

function resolveActionLayout(variant: Props['variant'], width: number): ActionLayout {
  if (variant && variant !== 'auto') return variant;
  if (width >= 1280) return 'full';
  if (width >= 1040) return 'compact';
  return 'icons';
}

export function TransactionsHeaderActions({
  theme,
  exporting = false,
  onExport,
  onAddTransaction,
  variant = 'auto',
}: Props) {
  const { width } = useWindowDimensions();
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);
  const layout = resolveActionLayout(variant, width);
  const isIcons = layout === 'icons';
  const exportLabel = layout === 'full' ? 'Exportar Excel' : 'Exportar';
  const addLabel = layout === 'full' ? 'Nova transação' : 'Nova';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onExport}
        disabled={exporting}
        style={[
          isIcons ? styles.iconBtn : styles.secondaryBtn,
          exporting && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Exportar Excel"
        {...(Platform.OS === 'web' ? { title: 'Exportar Excel' } : {})}
      >
        {exporting ? (
          <ActivityIndicator size="small" color={isIcons ? tokens.accent : theme.text} />
        ) : (
          <Ionicons
            name="download-outline"
            size={isIcons ? 22 : 18}
            color={isIcons ? tokens.accent : theme.text}
          />
        )}
        {!isIcons ? (
          <Text style={styles.secondaryText} numberOfLines={1}>
            {exportLabel}
          </Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onAddTransaction}
        style={isIcons ? styles.addIconBtn : styles.primaryBtn}
        accessibilityRole="button"
        accessibilityLabel="Nova transação"
        {...(Platform.OS === 'web' ? { title: 'Nova transação' } : {})}
      >
        <Ionicons name="add" size={isIcons ? 24 : 18} color="#FFFFFF" />
        {!isIcons ? (
          <Text style={styles.primaryText} numberOfLines={1}>
            {addLabel}
          </Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: Theme, tokens: ReturnType<typeof getTechTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      flexShrink: 0,
      maxWidth: '100%',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    secondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 0,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      flexShrink: 0,
      maxWidth: '100%',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      flexShrink: 0,
    },
    iconBtn: {
      padding: 8,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      flexShrink: 0,
    },
    addIconBtn: {
      backgroundColor: tokens.accent,
      borderRadius: mfRadius.sm,
      padding: 8,
      flexShrink: 0,
    },
    disabled: {
      opacity: 0.6,
    },
  });
}
