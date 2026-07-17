import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'

type ActionItem = {
  key: string
  title: string
  hint: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  loading?: boolean
  status?: 'ok' | 'warn' | 'neutral'
}

type Props = {
  actions: ActionItem[]
}

export function MeiMobileOverview ({ actions }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode])

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>O que você quer fazer?</Text>
      <Text style={styles.leadHint}>Toque em uma opção abaixo.</Text>
      {actions.map((item, index) => {
        const statusColor =
          item.status === 'ok' ? theme.success : item.status === 'warn' ? theme.warning : tokens.accent
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            disabled={item.loading}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
          >
            <View style={[styles.iconBox, { backgroundColor: `${statusColor}22` }]}>
              <Ionicons name={item.icon} size={22} color={statusColor} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.hint}>{item.hint}</Text>
            </View>
            <View style={styles.trail}>
              <Text style={styles.step}>{index + 1}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </View>
            {item.loading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={tokens.accent} />
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    root: {
      paddingHorizontal: mfSpacing.md,
      gap: mfSpacing.sm,
      paddingBottom: mfSpacing.md,
    },
    lead: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.3,
    },
    leadHint: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: mfSpacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.md,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      minHeight: 72,
      overflow: 'hidden',
    },
    rowPressed: { opacity: 0.9 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    hint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    trail: {
      alignItems: 'center',
      gap: 2,
    },
    step: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.textTertiary,
    },
    loading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(3,5,8,0.55)' : 'rgba(255,255,255,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: mfRadius.md,
    },
  })
}
