import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfSegmented } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';

type Props = {
  theme: Theme;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  viewTipo: 'entrada' | 'saida';
  onViewTipoChange: (value: 'entrada' | 'saida') => void;
  categoryCount: number;
  activeCount: number;
  onAddCategory: () => void;
  bare?: boolean;
};

export function CategoriasPageChrome({
  theme,
  searchTerm,
  onSearchChange,
  viewTipo,
  onViewTipoChange,
  categoryCount,
  activeCount,
  onAddCategory,
  bare = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const searchInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, bare), [theme, tokens, bare]);

  const subtitle =
    categoryCount === 1
      ? `1 categoria · ${activeCount} com movimento`
      : `${categoryCount} categorias · ${activeCount} com movimento`;

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Classificação</Text>
          </View>
          <Text style={styles.title}>Categorias</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onAddCategory}
          accessibilityRole="button"
          accessibilityLabel="Nova categoria"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, searchInset]}>
        <Ionicons name="search" size={18} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar categoria"
          placeholderTextColor={theme.placeholder}
          value={searchTerm}
          onChangeText={onSearchChange}
        />
      </View>

      <MfSegmented
        options={[
          { key: 'saida', label: 'Saídas', tone: 'expense' },
          { key: 'entrada', label: 'Entradas', tone: 'income' },
        ]}
        value={viewTipo}
        onChange={onViewTipoChange}
        style={styles.segmented}
      />
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  bare: boolean,
) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      paddingHorizontal: bare ? 0 : mfSpacing.md,
      paddingTop: bare ? 0 : mfSpacing.md,
      paddingBottom: mfSpacing.sm,
      gap: mfSpacing.md,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
    },
    titleCol: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      ...mfTypography.titleLarge,
      color: theme.text,
      letterSpacing: -0.4,
      fontSize: 20,
    },
    subtitle: {
      ...mfTypography.body,
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'web' ? 10 : 12,
      minHeight: Platform.OS === 'web' ? 44 : 48,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      minWidth: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    segmented: {
      alignSelf: 'stretch',
    },
  });
}
