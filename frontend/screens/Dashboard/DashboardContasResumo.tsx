import React, { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { mfSpacing } from '../../lib/theme'
import { getTechTokens } from '../../lib/techDesign'
import { useMfTheme } from '../../components/ui/useMfTheme'
import type { ContaFilterValue } from '../../lib/contaFinanceiraIntegration'
import type { ContaComSaldo } from '../../hooks/useUserContasFinanceiras'

type Props = {
  contas: ContaComSaldo[]
  selectedFilter: ContaFilterValue
  onSelectFilter: (filter: ContaFilterValue) => void
  /** Chips compactos, sem título — para ficar acima do cabeçalho da página. */
  variant?: 'default' | 'minimal'
}

export function DashboardContasResumo({
  contas,
  selectedFilter,
  onSelectFilter,
  variant = 'minimal',
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const router = useRouter()
  const isMinimal = variant === 'minimal'
  const styles = useMemo(() => createStyles(theme, isMinimal, isDarkMode), [theme, isMinimal, isDarkMode])

  if (contas.length === 0) return null

  return (
    <View style={styles.wrap}>
      {!isMinimal ? (
        <View style={styles.headerRow}>
          <Text style={styles.title}>Suas contas</Text>
          <Pressable
            onPress={() => router.push('/(app)/contas' as any)}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>Gerenciar</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primary} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <FilterChip
          label="Todas"
          active={selectedFilter === 'all'}
          onPress={() => onSelectFilter('all')}
          styles={styles}
          theme={theme}
          isMinimal={isMinimal}
          isDarkMode={isDarkMode}
        />
        {contas.map((c) => (
          <FilterChip
            key={c.id}
            label={c.nome}
            accent={c.cor || theme.primary}
            active={selectedFilter === c.id}
            onPress={() => onSelectFilter(c.id)}
            styles={styles}
            theme={theme}
            isMinimal={isMinimal}
            isDarkMode={isDarkMode}
          />
        ))}
        <FilterChip
          label="Meu financeiro"
          active={selectedFilter === 'unassigned'}
          onPress={() => onSelectFilter('unassigned')}
          styles={styles}
          theme={theme}
          isMinimal={isMinimal}
          isDarkMode={isDarkMode}
          accessibilityHint="Visão geral sem conta bancária vinculada"
        />
        {isMinimal ? (
          <Pressable
            onPress={() => router.push('/(app)/contas' as any)}
            style={({ pressed }) => [styles.manageIconBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Gerenciar contas"
          >
            <Ionicons name="settings-outline" size={16} color={theme.textTertiary} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

function FilterChip({
  label,
  accent,
  active,
  onPress,
  styles,
  theme,
  isMinimal,
  isDarkMode,
  accessibilityHint,
}: {
  label: string
  accent?: string
  active: boolean
  onPress: () => void
  styles: ReturnType<typeof createStyles>
  theme: ReturnType<typeof useMfTheme>['theme']
  isMinimal: boolean
  isDarkMode: boolean
  accessibilityHint?: string
}) {
  const tokens = getTechTokens(isDarkMode)

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active && {
          borderColor: accent || tokens.accent,
          backgroundColor: isMinimal ? tokens.accentSoft : theme.primaryLight,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {accent && !isMinimal ? (
        <View style={[styles.chipDot, { backgroundColor: accent }]} />
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          active && { color: accent || theme.primary, fontWeight: '600' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isMinimal: boolean,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    wrap: {
      marginBottom: isMinimal ? 0 : mfSpacing.lg,
      gap: isMinimal ? 0 : mfSpacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { fontSize: 15, fontWeight: '600', color: theme.text },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    linkText: { fontSize: 13, fontWeight: '600', color: theme.primary },
    chipsRow: {
      gap: isMinimal ? 6 : mfSpacing.sm,
      paddingVertical: isMinimal ? 2 : 4,
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isMinimal ? 12 : 12,
      paddingVertical: isMinimal ? 6 : 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isMinimal ? getTechTokens(isDarkMode).insetBorder : theme.border,
      backgroundColor: isMinimal ? getTechTokens(isDarkMode).insetFill : theme.backgroundMuted,
      maxWidth: 160,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: {
      fontSize: isMinimal ? 13 : 12,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    manageIconBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginLeft: 2,
    },
  })
}
