import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { MfTechKpiCard } from '../../components/ui'
import { mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../../components/ui/useMfTheme'
import { getTechTokens } from '../../lib/techDesign'

export function DashboardContaGlobalLink() {
  const { theme, isDarkMode } = useMfTheme()
  const router = useRouter()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens])

  return (
    <Pressable
      onPress={() => router.push('/(app)/conta-global' as never)}
      style={({ pressed }) => [styles.shell, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel="Abrir conta global em moedas internacionais"
    >
      <MfTechKpiCard level="metric" style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: tokens.accentSoft }]}>
            <Ionicons name="globe-outline" size={20} color={tokens.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Internacional</Text>
            <Text style={styles.title}>Conta global</Text>
            <Text style={styles.sub}>USD, EUR e outras — fora do saldo em reais</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </View>
      </MfTechKpiCard>
    </Pressable>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    shell: {
      marginBottom: mfSpacing.md,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    card: {
      borderLeftWidth: 3,
      borderLeftColor: tokens.accent,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, gap: 2, minWidth: 0 },
    eyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: tokens.accent,
    },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, letterSpacing: -0.2 },
    sub: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },
  })
}
