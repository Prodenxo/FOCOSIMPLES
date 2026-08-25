import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  visible: boolean
  mode: 'create' | 'edit'
  initialName?: string
  initialDescription?: string
  saving?: boolean
  onCancel: () => void
  onSubmit: (input: { name: string; description: string }) => void
}

export function FiscalProductGroupFormModal({
  visible,
  mode,
  initialName = '',
  initialDescription = '',
  saving = false,
  onCancel,
  onSubmit,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { width } = useWindowDimensions()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (visible) {
      setName(initialName)
      setDescription(initialDescription)
    }
  }, [visible, initialName, initialDescription])

  const modalWidth = Math.min(480, width - 32)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: mfSpacing.lg,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.65)' : 'rgba(15, 23, 42, 0.4)',
          ...(Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(8px)' } as Record<string, string>)
            : {}),
        },
        card: {
          width: modalWidth,
          backgroundColor: theme.background,
          borderRadius: mfRadius.xl,
          padding: mfSpacing.lg,
          gap: mfSpacing.md,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border,
          zIndex: 2,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 28px 72px rgba(0,0,0,0.55)'
                  : '0 24px 56px rgba(15, 23, 42, 0.18)',
              } as Record<string, string>)
            : {}),
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: mfSpacing.md,
        },
        title: { ...mfTypography.title, color: theme.text, flex: 1 },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: mfRadius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: theme.borderLight,
        },
        subtitle: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm + 2,
          ...mfTypography.body,
          color: theme.text,
          backgroundColor: theme.inputBackground ?? theme.surface,
        },
        textarea: { minHeight: 96, textAlignVertical: 'top' },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: mfSpacing.sm,
          marginTop: mfSpacing.xs,
        },
        secondaryBtn: {
          borderWidth: 1,
          borderColor: theme.borderLight,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm + 2,
          minHeight: 42,
          justifyContent: 'center',
        },
        secondaryText: { ...mfTypography.bodyStrong, color: theme.textSecondary },
        primaryBtn: {
          backgroundColor: theme.primary,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm + 2,
          minWidth: 128,
          minHeight: 42,
          alignItems: 'center',
          justifyContent: 'center',
        },
        primaryText: { ...mfTypography.bodyStrong, color: '#fff' },
      }),
    [isDarkMode, modalWidth, theme],
  )

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, description: description.trim() })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onCancel}
          accessibilityLabel="Fechar modal"
        />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: mfSpacing.xs }}>
              <Text style={styles.title}>
                {mode === 'create' ? 'Novo grupo fiscal' : 'Editar grupo fiscal'}
              </Text>
              <Text style={styles.subtitle}>
                Organize produtos por categoria lógica. O grupo não define tributação automaticamente.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onCancel}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: mfSpacing.xs }}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Vestuário - Revenda"
              placeholderTextColor={theme.textTertiary}
              editable={!saving}
              autoFocus={visible}
            />
          </View>

          <View style={{ gap: mfSpacing.xs }}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Opcional — organização lógica dos produtos"
              placeholderTextColor={theme.textTertiary}
              multiline
              editable={!saving}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSubmit}
              disabled={saving || !name.trim()}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryText}>{mode === 'create' ? 'Criar grupo' : 'Salvar'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
