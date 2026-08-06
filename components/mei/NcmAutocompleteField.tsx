import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { useMeiFlowStyles } from './meiFlowUi'
import {
  cleanNcmDescription,
  formatNcmCodeDisplay,
  formatNcmLabel,
  NCM_HELP_TOOLTIP,
  normalizeNcmCode,
  stripNcmHtml,
} from '../../lib/ncmFormat'
import {
  listarCatalogoNcms,
  sugerirCatalogoNcms,
  type NcmReferencia,
} from '../../services/meiNotasService'
import { useAppToastStore } from '../../store/appToastStore'

export type NcmAutocompleteFieldProps = {
  value: string
  onChange: (ncm: string, option?: NcmReferencia) => void
  /** Texto do produto — usado para sugestão automática quando NCM vazio. */
  productHint?: string
  required?: boolean
}

const DEBOUNCE_MS = 320

export function NcmAutocompleteField ({
  value,
  onChange,
  productHint = '',
  required = false,
}: NcmAutocompleteFieldProps) {
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()
  const showToast = useAppToastStore((s) => s.show)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NcmReferencia[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProductHintRef = useRef('')

  const normalizedValue = normalizeNcmCode(value)

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < 2) {
      setResults([])
      setDropdownOpen(false)
      setSearchError(null)
      return
    }
    setLoading(true)
    setSearchError(null)
    try {
      const data = trimmed.length >= 3 && /[a-zA-ZÀ-ÿ]/.test(trimmed)
        ? await sugerirCatalogoNcms({ texto: trimmed, limit: 12 })
        : await listarCatalogoNcms({ q: trimmed, limit: 12 })
      setResults(data)
      setDropdownOpen(data.length > 0)
      if (data.length === 0) {
        setSearchError('Nenhum NCM encontrado — tente outro termo (ex.: peixe, caderno).')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Não foi possível buscar NCM.'
      setResults([])
      setDropdownOpen(false)
      setSearchError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const scheduleSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(text)
    }, DEBOUNCE_MS)
  }, [runSearch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  useEffect(() => {
    if (normalizedValue.length === 8 && selectedLabel) return
    if (normalizedValue.length === 8 && !selectedLabel) {
      setSelectedLabel(formatNcmLabel(normalizedValue, ''))
    }
    if (!normalizedValue) setSelectedLabel('')
  }, [normalizedValue, selectedLabel])

  useEffect(() => {
    const hint = productHint.trim()
    if (!hint || normalizedValue.length === 8) return
    if (hint === lastProductHintRef.current) return
    lastProductHintRef.current = hint
    setQuery(hint)
    scheduleSearch(hint)
  }, [productHint, normalizedValue.length, scheduleSearch])

  const handleSelect = (option: NcmReferencia) => {
    const code = normalizeNcmCode(option.code)
    setSelectedLabel(option.label || formatNcmLabel(code, option.description))
    setQuery('')
    setResults([])
    setDropdownOpen(false)
    onChange(code, option)
  }

  const showHelp = () => {
    Alert.alert('O que é NCM?', NCM_HELP_TOOLTIP)
  }

  const borderColor = useMemo(
    () => (isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
    [isDarkMode],
  )

  return (
    <View style={flow.field}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={[flow.label, { color: theme.text, marginBottom: 0 }]}>
          Buscar NCM pelo produto
          {required ? <Text style={{ color: theme.error }}> *</Text> : null}
        </Text>
        <Pressable
          onPress={showHelp}
          accessibilityRole="button"
          accessibilityLabel="Ajuda sobre NCM"
          hitSlop={8}
        >
          <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Text style={[flow.hint, { color: theme.textSecondary, marginBottom: 8 }]}>
        {NCM_HELP_TOOLTIP}
      </Text>

      <TextInput
        style={flow.input}
        placeholder="Ex.: caderno, camisa, parafuso…"
        placeholderTextColor={theme.placeholder}
        value={query}
        onChangeText={(t) => {
          setQuery(t)
          scheduleSearch(t)
        }}
        onFocus={() => {
          if (results.length > 0) setDropdownOpen(true)
        }}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>Buscando NCM…</Text>
        </View>
      ) : null}

      {searchError && !loading ? (
        <Text style={{ fontSize: 12, color: theme.error, marginTop: 8 }}>
          {searchError}
        </Text>
      ) : null}

      {dropdownOpen && results.length > 0 ? (
        <ScrollView
          style={{
            maxHeight: 220,
            marginTop: 8,
            borderWidth: 1,
            borderColor,
            borderRadius: 10,
            backgroundColor: theme.surface,
          }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {results.map((option) => {
            const selected = normalizeNcmCode(option.code) === normalizedValue
            return (
              <Pressable
                key={option.code}
                onPress={() => handleSelect(option)}
                accessibilityRole="button"
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                  backgroundColor: selected
                    ? (isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
                    : 'transparent',
                }}
              >
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                  {formatNcmCodeDisplay(option.code)}
                </Text>
                <Text
                  style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}
                  numberOfLines={2}
                >
                  {cleanNcmDescription(option.description) || stripNcmHtml(option.label)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      {normalizedValue.length === 8 ? (
        <View
          style={{
            marginTop: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
          }}
        >
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>NCM selecionado</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 2 }}>
            {selectedLabel || formatNcmLabel(normalizedValue, '')}
          </Text>
          <Pressable
            onPress={() => {
              onChange('')
              setSelectedLabel('')
              setQuery('')
            }}
            accessibilityRole="button"
            style={{ marginTop: 6 }}
          >
            <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
              Limpar seleção
            </Text>
          </Pressable>
        </View>
      ) : (
        !searchError && !loading ? (
        <Text style={[flow.hint, { color: theme.textSecondary, marginTop: 8 }]}>
          Selecione uma opção na lista para preencher o código de 8 dígitos.
        </Text>
        ) : null
      )}
    </View>
  )
}
