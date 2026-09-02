import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { formatProductCount } from '@/lib/fiscalConfiguration/fiscalGroupUi'
import type { FiscalProductGroup } from '@/lib/fiscalConfiguration/types'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  visible: boolean
  groups: FiscalProductGroup[]
  groupProductCounts: Record<string, number>
  onClose: () => void
  onEditGroup: (group: FiscalProductGroup) => void
  onCreateGroup: () => void
}

export function FiscalProductGroupManageModal({
  visible,
  groups,
  groupProductCounts,
  onClose,
  onEditGroup,
  onCreateGroup,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { width, height } = useWindowDimensions()
  const activeGroups = groups.filter((g) => g.status === 'ACTIVE')
  const modalWidth = Math.min(520, width - 32)
  const modalMaxHeight = Math.min(560, height * 0.78)

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
        sheet: {
          width: modalWidth,
          maxHeight: modalMaxHeight,
          backgroundColor: theme.background,
          borderRadius: mfRadius.xl,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border,
          overflow: 'hidden',
          zIndex: 2,
          paddingBottom: Platform.OS === 'ios' ? mfSpacing.lg : mfSpacing.md,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 28px 72px rgba(0,0,0,0.55)'
                  : '0 24px 56px rgba(15, 23, 42, 0.18)',
              } as Record<string, string>)
            : {}),
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: mfSpacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        title: { ...mfTypography.subtitle, color: theme.text },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          gap: mfSpacing.md,
        },
        rowMain: { flex: 1, gap: 2 },
        rowTitle: { ...mfTypography.body, color: theme.text, fontWeight: '600' },
        rowMeta: { ...mfTypography.caption, color: theme.textSecondary },
        editBtn: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: 6,
        },
        editText: { ...mfTypography.caption, color: theme.primary, fontWeight: '600' },
        empty: { padding: mfSpacing.xl, alignItems: 'center', gap: mfSpacing.md },
        emptyText: { ...mfTypography.body, color: theme.textSecondary, textAlign: 'center' },
        addBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mfSpacing.xs,
          margin: mfSpacing.lg,
          paddingVertical: mfSpacing.md,
          borderWidth: 1,
          borderColor: theme.primary,
          borderRadius: mfRadius.md,
        },
        addText: { ...mfTypography.body, color: theme.primary, fontWeight: '600' },
      }),
    [isDarkMode, modalWidth, theme],
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Grupos fiscais</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {activeGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Este cliente ainda não possui grupos fiscais.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {activeGroups.map((group) => (
                <View key={group.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{group.name}</Text>
                    <Text style={styles.rowMeta}>
                      {formatProductCount(groupProductCounts[group.id] ?? 0)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => onEditGroup(group)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.editText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.addBtn} onPress={onCreateGroup} accessibilityRole="button">
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={styles.addText}>Novo grupo fiscal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
