import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

export function FiscalFormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.lg,
          padding: mfSpacing.lg,
          gap: mfSpacing.md,
          backgroundColor: theme.surface,
        },
        title: { ...mfTypography.subtitle, color: theme.text },
      }),
    [theme],
  )
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  )
}

export function FiscalFieldInput({
  label,
  value,
  onChangeText,
  disabled,
  keyboardType = 'default',
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  disabled?: boolean
  keyboardType?: 'default' | 'numeric'
  placeholder?: string
}) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.xs },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          ...mfTypography.body,
          color: theme.text,
          backgroundColor: disabled ? theme.backgroundMuted : theme.surface,
        },
      }),
    [disabled, theme],
  )
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  )
}

export function FiscalComputedField({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  const { theme, isDarkMode } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.xs },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        valueBox: {
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.borderLight,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : theme.backgroundMuted,
        },
        value: {
          ...mfTypography.body,
          color: theme.text,
          fontWeight: '600',
          fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : undefined,
        },
        hint: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
      }),
    [isDarkMode, theme],
  )
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueBox} accessibilityLabel={`${label}: ${value || 'vazio'}`}>
        <Text style={styles.value}>{value || '—'}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}
