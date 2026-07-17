import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  type ListRenderItem,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  getSiteTokens,
  mfSiteInput,
  mfSiteSecondaryBtn,
  siteFieldLabelStyle,
} from '../../lib/siteDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'
import {
  ALL_PHONE_COUNTRIES,
  type PhoneCountry,
  buildInternationalPhone,
  splitInternationalPhone,
} from '../../lib/phoneCountries'
import { CountryFlagImage } from './CountryFlagImage'
import {
  formatNationalPhoneInput,
} from '../../lib/internationalPhone'
import { getWebScrollViewProps } from '../../lib/webScrollbar'
import { getWebButtonDomProps } from '../../lib/webButtonDom'

export type SettingsPhoneFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  saving?: boolean
  disabled?: boolean
  isLast?: boolean
}

export function SettingsPhoneField ({
  label,
  value,
  onChange,
  onSave,
  saving = false,
  disabled = false,
  isLast = false,
}: SettingsPhoneFieldProps) {
  const { isDarkMode } = useMfTheme()
  const tokens = getSiteTokens(isDarkMode)
  const saveDisabled = disabled || saving

  return (
    <View style={[styles.block, { borderBottomColor: tokens.divider }, isLast && styles.blockLast]}>
      <Text style={[siteFieldLabelStyle, styles.label, { color: tokens.textSecondary }]}>
        {label}
      </Text>

      <View style={styles.row}>
        <View style={styles.inputWrap}>
          <SettingsPhoneInput
            value={value}
            onChange={onChange}
            isDarkMode={isDarkMode}
            tokens={tokens}
          />
        </View>

        <Pressable
          onPress={() => void onSave()}
          disabled={saveDisabled}
          {...getWebButtonDomProps()}
          style={({ pressed }) => [
            mfSiteSecondaryBtn(isDarkMode),
            styles.saveBtn,
            saveDisabled && styles.saveBtnDisabled,
            pressed && !saveDisabled && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Salvando telefone' : 'Salvar telefone'}
          accessibilityState={{ disabled: saveDisabled }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={tokens.neon} />
          ) : (
            <Text style={[styles.saveBtnText, { color: tokens.neon }]} numberOfLines={1}>
              Salvar
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

type InputProps = {
  value: string
  onChange: (value: string) => void
  isDarkMode: boolean
  tokens: ReturnType<typeof getSiteTokens>
}

function SettingsPhoneInput ({
  value,
  onChange,
  isDarkMode,
  tokens,
}: InputProps) {
  const { theme } = useMfTheme()
  const initial = useMemo(() => splitInternationalPhone(value), [value])
  const [country, setCountry] = useState<PhoneCountry>(initial.country)
  const [nationalInput, setNationalInput] = useState(
    formatNationalPhoneInput(initial.country.iso, initial.nationalDigits),
  )
  const [pickerVisible, setPickerVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const next = splitInternationalPhone(value)
    setCountry(next.country)
    setNationalInput(formatNationalPhoneInput(next.country.iso, next.nationalDigits))
  }, [value])

  const emitChange = (nextCountry: PhoneCountry, nextNational: string) => {
    onChange(buildInternationalPhone(nextCountry, nextNational))
  }

  const handleNationalChange = (text: string) => {
    const formatted = formatNationalPhoneInput(country.iso, text)
    setNationalInput(formatted)
    emitChange(country, formatted)
  }

  const handleSelectCountry = (nextCountry: PhoneCountry) => {
    setCountry(nextCountry)
    setPickerVisible(false)
    setSearchQuery('')
    emitChange(nextCountry, nationalInput)
  }

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ALL_PHONE_COUNTRIES
    return ALL_PHONE_COUNTRIES.filter((item) => {
      const haystack = `${item.name} ${item.dialCode} ${item.iso}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [searchQuery])

  const webListScrollProps =
    Platform.OS === 'web'
      ? getWebScrollViewProps(theme, { extraClassName: 'mf-country-picker-list' })
      : {}

  const renderCountryRow: ListRenderItem<PhoneCountry> = ({ item }) => {
    const selected = item.iso === country.iso
    return (
      <Pressable
        onPress={() => handleSelectCountry(item)}
        style={({ pressed }) => [
          styles.countryRow,
          { borderBottomColor: tokens.divider },
          selected && { backgroundColor: tokens.neonDim },
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.countryRowFlagWrap}>
          <CountryFlagImage iso={item.iso} height={20} label={item.name} />
        </View>
        <Text
          style={[styles.countryRowName, { color: tokens.textPrimary }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.countryRowDial, { color: tokens.textSecondary }]}>
          +{item.dialCode}
        </Text>
      </Pressable>
    )
  }

  return (
    <>
      <View
        style={[
          styles.phoneRow,
          mfSiteInput(isDarkMode),
          { borderColor: tokens.inputBorder, backgroundColor: tokens.inputBg },
        ]}
      >
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={styles.countryBtn}
          accessibilityRole="button"
          accessibilityLabel={`Código do país, mais ${country.dialCode}`}
        >
          <CountryFlagImage iso={country.iso} height={18} label={country.name} />
          <Text style={[styles.countryDial, { color: tokens.textPrimary }]}>
            +{country.dialCode}
          </Text>
          <Ionicons name="chevron-down" size={14} color={tokens.textMuted} />
        </Pressable>

        <TextInput
          style={[styles.phoneInput, { color: tokens.textPrimary }]}
          value={nationalInput}
          onChangeText={handleNationalChange}
          placeholder={country.iso === 'br' ? '(11) 99999-9999' : 'Número com DDD'}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholderTextColor={tokens.textMuted}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={() => undefined}
        />
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPickerVisible(false)
          setSearchQuery('')
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setPickerVisible(false)
            setSearchQuery('')
          }}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: tokens.panelBg,
                borderColor: tokens.panelBorder,
                shadowColor: '#000',
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: tokens.textPrimary }]}>
              Código do país
            </Text>

            <View
              style={[
                styles.searchRow,
                mfSiteInput(isDarkMode),
                { borderColor: tokens.inputBorder, backgroundColor: tokens.inputBg },
              ]}
            >
              <Ionicons name="search" size={16} color={tokens.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar país"
                placeholderTextColor={tokens.textMuted}
                style={[styles.searchInput, { color: tokens.textPrimary }]}
                autoFocus
              />
            </View>

            <View style={styles.countryListWrap}>
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.iso}
                renderItem={renderCountryRow}
                keyboardShouldPersistTaps="handled"
                style={[styles.countryList, webListScrollProps.style]}
                contentContainerStyle={styles.countryListContent}
                {...webListScrollProps}
                showsVerticalScrollIndicator
                ListEmptyComponent={
                  <Text style={[styles.emptySearch, { color: tokens.textSecondary }]}>
                    Nenhum país encontrado
                  </Text>
                }
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  inputWrap: {
    flex: 1,
    minWidth: 0,
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    borderWidth: 1,
    borderRadius: mfRadius.md,
    overflow: 'hidden',
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
  },
  countryDial: {
    fontSize: 14,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: mfSpacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    borderRadius: mfRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.sm,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: mfSpacing.lg,
    marginBottom: mfSpacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.sm,
    marginHorizontal: mfSpacing.lg,
    marginBottom: mfSpacing.sm,
    paddingHorizontal: mfSpacing.md,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: mfRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  countryListWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: 380,
  },
  countryList: {
    flex: 1,
    paddingHorizontal: mfSpacing.sm,
  },
  countryListContent: {
    paddingBottom: mfSpacing.sm,
    paddingRight: mfSpacing.xs,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: mfSpacing.md,
    paddingVertical: mfSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: mfSpacing.sm,
    borderRadius: mfRadius.md,
  },
  countryRowFlagWrap: {
    width: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryRowName: {
    flex: 1,
    fontSize: 15,
  },
  countryRowDial: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptySearch: {
    textAlign: 'center',
    paddingVertical: mfSpacing.lg,
    fontSize: 14,
  },
})
