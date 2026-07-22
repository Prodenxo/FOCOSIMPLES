import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  evaluatePasswordStrength,
  type PasswordStrengthLevel,
} from '../../lib/passwordPolicy'
import { useMfTheme } from './useMfTheme'

export type PasswordStrengthMeterProps = {
  password: string
}

const LEVEL_COLOR: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  ruim: '#EF4444',
  media: '#F59E0B',
  forte: '#22C55E',
  excelente: '#10B981',
}

/**
 * Barra de força + checklist de critérios (política alinhada ao backend).
 */
export function PasswordStrengthMeter ({ password }: PasswordStrengthMeterProps) {
  const { theme, isDarkMode } = useMfTheme()
  const result = useMemo(() => evaluatePasswordStrength(password), [password])

  if (result.level === 'empty') {
    return (
      <View style={styles.wrap} accessibilityLabel="Critérios de senha">
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Critérios: mín. 8 caracteres, 1 maiúscula e 1 caractere especial.
        </Text>
        {result.criteria.map((c) => (
          <View key={c.id} style={styles.row}>
            <Ionicons
              name="ellipse-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.criterion, { color: theme.textSecondary }]}>
              {c.label}
              {c.required ? ' · obrigatório' : ''}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  const color = LEVEL_COLOR[result.level]
  const trackBg = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(result.progress * 100),
        text: result.label,
      }}
      accessibilityLabel={`Força da senha: ${result.label}`}
    >
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: theme.textSecondary }]}>Força da senha</Text>
        <Text style={[styles.barLevel, { color }]}>{result.label}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(result.progress * 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <View style={styles.criteria}>
        {result.criteria.map((c) => (
          <View key={c.id} style={styles.row}>
            <Ionicons
              name={c.met ? 'checkmark-circle' : 'close-circle-outline'}
              size={15}
              color={c.met ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.criterion,
                { color: c.met ? theme.text : theme.textSecondary },
                c.met && styles.criterionMet,
              ]}
            >
              {c.label}
              {c.required && !c.met ? ' · obrigatório' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
    gap: 6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  barLevel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  criteria: {
    gap: 4,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criterion: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  criterionMet: {
    fontWeight: '600',
  },
})

export default PasswordStrengthMeter
