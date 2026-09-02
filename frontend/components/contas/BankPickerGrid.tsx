import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';
import { useMfTheme } from '../ui/useMfTheme';
import {
  CUSTOM_BANK_ID,
  filterBanksByQuery,
  type BankCatalogEntry,
} from '../../lib/bankCatalog';
import { BankCatalogIcon } from './BankIcon';
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar';

type Props = {
  selectedBankId: string | null;
  onSelectBank: (bank: BankCatalogEntry) => void;
  onSelectCustom: () => void;
};

const GRID_MAX_HEIGHT_WEB = 300;
const GRID_MAX_HEIGHT_NATIVE = 360;

export function BankPickerGrid({
  selectedBankId,
  onSelectBank,
  onSelectCustom,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const isNative = Platform.OS !== 'web';
  const cols = width >= 520 ? 4 : width >= 380 ? 3 : 2;
  const styles = useMemo(
    () => createStyles(theme, tokens, cols, isNative),
    [theme, tokens, cols, isNative],
  );
  const inset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const searchInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);

  const banks = useMemo(() => filterBanksByQuery(query), [query]);
  const isCustom = selectedBankId === CUSTOM_BANK_ID;

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHead}>
        <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
        <Text style={[styles.sectionLabel, { color: tokens.accent }]}>Escolha o banco</Text>
      </View>

      <View style={[styles.searchRow, searchInset]}>
        <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar banco…"
          placeholderTextColor={theme.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={[styles.gridScroll, Platform.OS === 'web' ? getWebScrollbarStyle(theme) : null]}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
      >
        <View style={styles.grid}>
          {banks.map((bank) => {
            const active = selectedBankId === bank.id;
            return (
              <TouchableOpacity
                key={bank.id}
                style={[styles.tile, inset, active && styles.tileActive]}
                onPress={() => onSelectBank(bank)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={bank.nome}
              >
                <BankCatalogIcon bank={bank} size={isNative ? 44 : 40} />
                <Text
                  style={[styles.tileLabel, active && styles.tileLabelActive]}
                  numberOfLines={2}
                >
                  {bank.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.customRow, inset, isCustom && styles.customRowActive]}
        onPress={onSelectCustom}
        accessibilityRole="button"
        accessibilityState={{ selected: isCustom }}
      >
        <View style={[styles.customIcon, isCustom && { borderColor: tokens.accent }]}>
          <Ionicons
            name="create-outline"
            size={20}
            color={isCustom ? tokens.accent : theme.textSecondary}
          />
        </View>
        <View style={styles.customTextCol}>
          <Text style={[styles.customTitle, isCustom && { color: tokens.accent }]}>
            Outra conta
          </Text>
          <Text style={styles.customHint}>Nome personalizado, carteira, cofre…</Text>
        </View>
        <Ionicons
          name={isCustom ? 'checkmark-circle' : 'chevron-forward'}
          size={20}
          color={isCustom ? tokens.accent : theme.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  cols: number,
  isNative: boolean,
) {
  const tileWidth = `${100 / cols}%` as const;

  return StyleSheet.create({
    wrap: { gap: mfSpacing.sm },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: isNative ? 12 : 10,
      minHeight: isNative ? 44 : undefined,
    },
    searchInput: {
      flex: 1,
      fontSize: isNative ? 16 : 15,
      color: theme.text,
      padding: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    gridScroll: {
      maxHeight: isNative ? GRID_MAX_HEIGHT_NATIVE : GRID_MAX_HEIGHT_WEB,
    },
    gridContent: {
      paddingBottom: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    tile: {
      width: tileWidth,
      padding: 4,
      alignItems: 'center',
      gap: 6,
      paddingVertical: isNative ? 12 : 10,
      marginBottom: 4,
      overflow: 'hidden',
    },
    tileActive: {
      borderColor: tokens.accent,
      backgroundColor: tokens.accentSoft,
    },
    tileLabel: {
      fontSize: isNative ? 12 : 11,
      fontWeight: '500',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    tileLabelActive: {
      color: tokens.accent,
      fontWeight: '600',
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: isNative ? 14 : 12,
      marginTop: 4,
      borderStyle: 'dashed',
    },
    customRowActive: {
      borderColor: tokens.accent,
      borderStyle: 'solid',
      backgroundColor: tokens.accentSoft,
    },
    customIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
    },
    customTextCol: { flex: 1, gap: 2 },
    customTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
    customHint: { fontSize: 12, color: theme.textTertiary },
  });
}
