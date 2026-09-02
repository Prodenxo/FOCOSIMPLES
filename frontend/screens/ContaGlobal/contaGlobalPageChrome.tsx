import React, { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme'
import { getTechTokens } from '../../lib/techDesign'
import { useMfTheme } from '../../components/ui/useMfTheme'

type Props = {
  theme: Theme
  moedaCount: number
  onAddMoeda: () => void
  bare?: boolean
}

export function ContaGlobalPageChrome({
  theme,
  moedaCount,
  onAddMoeda,
  bare = false,
}: Props) {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, bare), [theme, tokens, bare])

  const subtitle =
    moedaCount === 1 ? '1 moeda cadastrada' : `${moedaCount} moedas cadastradas`

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Internacional</Text>
          </View>
          <Text style={styles.title}>Conta global</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onAddMoeda}
          accessibilityRole="button"
          accessibilityLabel="Adicionar moeda"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>
        Separado do saldo em reais — cotação de referência.
      </Text>
    </View>
  )
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
      gap: mfSpacing.sm,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
    },
    titleCol: { flex: 1, minWidth: 0 },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
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
    disclaimer: {
      fontSize: 12,
      color: theme.textTertiary,
      lineHeight: 17,
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
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  })
}
