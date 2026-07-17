import React from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type TextInputProps,
} from 'react-native'
import { getSiteTokens, mfSiteInput, mfSiteSecondaryBtn, siteFieldLabelStyle, siteHintStyle } from '../../lib/siteDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'

export type SettingsProfileFieldProps = {
  label: string
  value: string
  onChangeText: (value: string) => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  savingLabel?: string
  disabled?: boolean
  hint?: string
  placeholder?: string
  isLast?: boolean
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'style'>
}

export function SettingsProfileField ({
  label,
  value,
  onChangeText,
  onSave,
  saving = false,
  saveLabel = 'Salvar',
  savingLabel = 'Salvando…',
  disabled = false,
  hint,
  placeholder,
  isLast = false,
  inputProps,
}: SettingsProfileFieldProps) {
  const { isDarkMode } = useMfTheme()
  const tokens = getSiteTokens(isDarkMode)
  const saveDisabled = disabled || saving

  return (
    <View style={[styles.block, { borderBottomColor: tokens.divider }, isLast && styles.blockLast]}>
      <Text style={[siteFieldLabelStyle, styles.label, { color: tokens.textSecondary }]}>{label}</Text>

      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            mfSiteInput(isDarkMode),
            { color: tokens.textPrimary },
          ]}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          value={value}
          onChangeText={onChangeText}
          {...inputProps}
        />

        <Pressable
          onPress={onSave}
          disabled={saveDisabled}
          style={({ pressed }) => [
            mfSiteSecondaryBtn(isDarkMode),
            styles.saveBtn,
            saveDisabled && styles.saveBtnDisabled,
            pressed && !saveDisabled && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={saving ? savingLabel : saveLabel}
          accessibilityState={{ disabled: saveDisabled }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={tokens.neon} />
          ) : (
            <Text style={[styles.saveBtnText, { color: tokens.neon }]} numberOfLines={1}>
              {saveLabel}
            </Text>
          )}
        </Pressable>
      </View>

      {hint ? (
        <Text style={[siteHintStyle, styles.hint, { color: tokens.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    paddingBottom: mfSpacing.md,
    marginBottom: mfSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  label: {
    marginBottom: mfSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: mfRadius.md,
  },
  hint: {
    marginTop: mfSpacing.sm,
    lineHeight: 16,
  },
  saveBtn: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
})
